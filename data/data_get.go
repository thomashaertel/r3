package data

import (
	"context"
	"errors"
	"fmt"
	"r3/cache"
	"r3/db"
	"r3/handler"
	"r3/schema/lookups"
	"r3/types"
	"regexp"
	"strconv"
	"strings"
	"tools"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
	"github.com/jackc/pgx/v4"
)

var regexRelId = regexp.MustCompile(`^\_r(\d+)id`) // finds: _r3id

// get data
// updates SQL query pointer value (for error logging), data rows and total count
func Get_tx(ctx context.Context, tx pgx.Tx, data types.DataGet, loginId int64,
	query *string) ([]types.DataGetResult, int, error) {

	var err error
	results := make([]types.DataGetResult, 0)
	queryArgs := make([]interface{}, 0) // SQL arguments for data query
	queryCount := ""
	queryCountArgs := make([]interface{}, 0) // SQL arguments for count query (potentially less, no expressions besides COUNT)

	// prepare SQL query for data GET request
	*query, queryCount, err = prepareQuery(data, &queryArgs, &queryCountArgs, loginId, 0)
	if err != nil {
		return results, 0, err
	}

	// execute SQL query
	rows, err := tx.Query(ctx, *query, queryArgs...)
	if err != nil {
		return results, 0, err
	}
	columns := rows.FieldDescriptions()

	for rows.Next() {

		// put unknown data types into interfaces
		valuePointers := make([]interface{}, len(columns))
		valuesAll := make([]interface{}, len(columns))
		for i, _ := range columns {
			valuePointers[i] = &valuesAll[i]
		}

		if err := rows.Scan(valuePointers...); err != nil {
			return results, 0, err
		}

		indexRecordIds := make(map[int]interface{}) // ID for each relation tupel by index
		values := make([]interface{}, 0)            // final values for selected attributes

		// collect values for expressions
		for i := 0; i < len(data.Expressions); i++ {
			if fmt.Sprintf("%T", valuesAll[i]) == "pgtype.Numeric" {
				valuesAll[i] = db.PgxNumericToString(valuesAll[i].(pgtype.Numeric))
			}
			values = append(values, valuesAll[i])
		}

		// collect relation tupel IDs
		// relation ID columns start after expressions
		for i, j := len(data.Expressions), len(columns); i < j; i++ {

			matches := regexRelId.FindStringSubmatch(string(columns[i].Name))

			if len(matches) == 2 {

				// column provides relation ID
				relIndex, err := strconv.Atoi(matches[1])
				if err != nil {
					return results, 0, err
				}
				indexRecordIds[relIndex] = valuesAll[i]
			}
		}

		results = append(results, types.DataGetResult{
			IndexRecordIds: indexRecordIds,
			Values:         values,
		})
	}
	rows.Close()

	// work out result count
	count := len(results)

	if data.Limit != 0 && (count >= data.Limit || data.Offset != 0) {
		// defined limit has been reached or offset was used, get total count
		if err := tx.QueryRow(ctx, queryCount, queryCountArgs...).Scan(&count); err != nil {
			return results, 0, err
		}
	}
	return results, count, nil
}

// build SELECT calls from data GET request
// queries can also be sub queries, a nesting level is included for separation (0 = main query)
// can optionally add expressions to collect all tupel IDs
// returns queries (data + count)
func prepareQuery(data types.DataGet, queryArgs *[]interface{}, queryCountArgs *[]interface{},
	loginId int64, nestingLevel int) (string, string, error) {

	// check for authorized access, READ(1) for GET
	for _, expr := range data.Expressions {
		if expr.AttributeId.Status == pgtype.Present && !authorizedAttribute(loginId, expr.AttributeId.Bytes, 1) {
			return "", "", errors.New(handler.ErrUnauthorized)
		}
	}

	var (
		inSelect       []string                  // select expressions
		inJoin         []string                  // relation joins
		mapIndex_relId = make(map[int]uuid.UUID) // map of all relations by index
	)

	// check source relation and module
	rel, exists := cache.RelationIdMap[data.RelationId]
	if !exists {
		return "", "", errors.New("relation does not exist")
	}

	mod, exists := cache.ModuleIdMap[rel.ModuleId]
	if !exists {
		return "", "", errors.New("module does not exist")
	}

	// JOIN relations connected via relationship attributes
	mapIndex_relId[data.IndexSource] = data.RelationId
	for _, join := range data.Joins {
		if join.IndexFrom == -1 { // source relation need not be joined
			continue
		}

		if err := joinRelation(mapIndex_relId, join, &inJoin, nestingLevel); err != nil {
			return "", "", err
		}
	}

	// define relation code for source relation
	// source relation might have index != 0 (for GET from joined relation)
	relCode := getRelationCode(data.IndexSource, nestingLevel)

	// build WHERE lines
	// before SELECT expressions because these are excluded from count query
	// SQL arguments are numbered ($1, $2, ...) with no way to skip any (? placeholder is not allowed);
	//  excluded sub queries arguments from SELECT expressions causes missing argument numbers
	queryWhere := ""
	if err := buildWhere(data.Filters, queryArgs, queryCountArgs, loginId,
		nestingLevel, &queryWhere); err != nil {

		return "", "", err
	}

	// process SELECT expressions
	mapIndex_agg := make(map[int]bool)        // map of indexes with aggregation
	mapIndex_aggRecords := make(map[int]bool) // map of indexes with record aggregation
	for pos, expr := range data.Expressions {

		// non-attribute expression
		if expr.AttributeId.Status != pgtype.Present {

			// in expressions of main query, disable SQL arguments for count query
			//  count query has no sub queries with arguments and only 1 expression: COUNT(*)
			queryCountArgsOptional := queryCountArgs
			if nestingLevel == 0 {
				queryCountArgsOptional = nil
			}

			subQuery, _, err := prepareQuery(expr.Query, queryArgs,
				queryCountArgsOptional, loginId, nestingLevel+1)

			if err != nil {
				return "", "", err
			}
			inSelect = append(inSelect, fmt.Sprintf("(\n%s\n) AS %s",
				subQuery, getExpressionCodeSelect(pos)))

			continue
		}

		// attribute expression
		if err := selectAttribute(pos, expr, mapIndex_relId, &inSelect,
			nestingLevel); err != nil {

			return "", "", err
		}

		if expr.Aggregator.Status == pgtype.Present {
			mapIndex_agg[expr.Index] = true
		}
		if expr.Aggregator.String == "record" {
			mapIndex_aggRecords[expr.Index] = true
		}
	}

	// SELECT relation tupel IDs after attributes on main query
	if nestingLevel == 0 {
		for index, relId := range mapIndex_relId {

			// if an aggregation function is used on any index, we cannot deliver record IDs
			// unless a record aggregation functions is used on this specific relation index
			_, recordAggExists := mapIndex_aggRecords[index]
			if len(mapIndex_agg) != 0 && !recordAggExists {
				continue
			}

			if _, exists := cache.RelationIdMap[relId]; !exists {
				return "", "", errors.New("relation does not exist")
			}
			inSelect = append(inSelect, fmt.Sprintf(`"%s"."id" AS %s`,
				getRelationCode(index, nestingLevel),
				getTupelIdCode(index, nestingLevel)))
		}
	}

	// build GROUP BY line
	queryGroup := ""
	groupByItems := make([]string, 0)
	for i, expr := range data.Expressions {

		if expr.AttributeId.Status != pgtype.Present || (!expr.GroupBy && expr.Aggregator.Status != pgtype.Present) {
			continue
		}

		// group by record ID if record must be kept during aggregation
		if expr.Aggregator.String == "record" {
			relId := getTupelIdCode(expr.Index, nestingLevel)

			if !tools.StringInSlice(relId, groupByItems) {
				groupByItems = append(groupByItems, relId)
			}
		}

		// group by requested attribute
		if expr.GroupBy {
			groupByItems = append(groupByItems, getExpressionCodeSelect(i))
		}
	}
	if len(groupByItems) != 0 {
		queryGroup = fmt.Sprintf("\nGROUP BY %s", strings.Join(groupByItems, ", "))
	}

	// build ORDER BY, LIMIT, OFFSET lines
	queryOrder, queryLimit, queryOffset := "", "", ""
	if err := buildOrderLimitOffset(data, nestingLevel, &queryOrder, &queryLimit, &queryOffset); err != nil {
		return "", "", err
	}

	// build data query
	query := fmt.Sprintf(
		`SELECT %s`+"\n"+
			`FROM "%s"."%s" AS "%s" %s%s%s%s%s%s`,
		strings.Join(inSelect, `, `), // SELECT
		mod.Name, rel.Name, relCode,  // FROM
		strings.Join(inJoin, ""), // JOINS
		queryWhere,               // WHERE
		queryGroup,               // GROUP BY
		queryOrder,               // ORDER BY
		queryLimit,               // LIMIT
		queryOffset)              // OFFSET

	// build totals query (not relevant for sub queries)
	queryCount := ""
	if nestingLevel == 0 {

		// distinct to keep count for source relation records correct independent of joins
		queryCount = fmt.Sprintf(
			`SELECT COUNT(DISTINCT "%s"."%s")`+"\n"+
				`FROM "%s"."%s" AS "%s" %s%s`,
			getRelationCode(data.IndexSource, nestingLevel), lookups.PkName, // SELECT
			mod.Name, rel.Name, relCode, // FROM
			strings.Join(inJoin, ""), // JOINS
			queryWhere)               // WHERE

	}

	// add intendation for nested sub queries
	if nestingLevel != 0 {
		indent := strings.Repeat("\t", nestingLevel)
		query = indent + regexp.MustCompile(`\r?\n`).ReplaceAllString(query, "\n"+indent)
	}
	return query, queryCount, nil
}

// add SELECT for attribute in given relation index
// if attribute is from another relation than the given index (relationship),
//  attribute value = tupel IDs in relation with given index via given attribute
// 'outside in' is important in cases of self reference, where direction cannot be ascertained by attribute
func selectAttribute(exprPos int, expr types.DataGetExpression,
	mapIndex_relId map[int]uuid.UUID, inSelect *[]string, nestingLevel int) error {

	relCode := getRelationCode(expr.Index, nestingLevel)

	atr, exists := cache.AttributeIdMap[expr.AttributeId.Bytes]
	if !exists {
		return errors.New("attribute does not exist")
	}

	codeSelect := getExpressionCodeSelect(exprPos)

	if !expr.OutsideIn {
		// attribute is from index relation
		code, err := getAttributeCode(expr.AttributeId.Bytes, relCode)
		if err != nil {
			return err
		}

		// prepare distinct paramenter, not useful for min/max/record
		var distinct = ""
		if expr.Distincted {
			distinct = "DISTINCT "
		}

		// apply aggregator if desired
		switch expr.Aggregator.String {
		case "array":
			*inSelect = append(*inSelect, fmt.Sprintf("JSON_AGG(%s%s) AS %s", distinct, code, codeSelect))
		case "avg":
			*inSelect = append(*inSelect, fmt.Sprintf("AVG(%s%s)::NUMERIC(20,2) AS %s", distinct, code, codeSelect))
		case "count":
			*inSelect = append(*inSelect, fmt.Sprintf("COUNT(%s%s) AS %s", distinct, code, codeSelect))
		case "list":
			*inSelect = append(*inSelect, fmt.Sprintf("STRING_AGG(%s%s::TEXT, ', ') AS %s", distinct, code, codeSelect))
		case "max":
			*inSelect = append(*inSelect, fmt.Sprintf("MAX(%s) AS %s", code, codeSelect))
		case "min":
			*inSelect = append(*inSelect, fmt.Sprintf("MIN(%s) AS %s", code, codeSelect))
		case "sum":
			*inSelect = append(*inSelect, fmt.Sprintf("SUM(%s%s) AS %s", distinct, code, codeSelect))
		case "record":
			// groups record IDs for attribute relation (via index)
			// allows access to individual record IDs and attribute values while other aggregations are active
			*inSelect = append(*inSelect, fmt.Sprintf("FIRST(%s) AS %s", code, codeSelect))
		default:
			*inSelect = append(*inSelect, fmt.Sprintf("%s%s AS %s", distinct, code, codeSelect))
		}
		return nil
	}

	// attribute comes via relationship from other relation (or self reference from same relation)
	shipRel, exists := cache.RelationIdMap[atr.RelationId]
	if !exists {
		return errors.New("relation does not exist")
	}

	shipMod, exists := cache.ModuleIdMap[shipRel.ModuleId]
	if !exists {
		return errors.New("module does not exist")
	}

	// get tupel IDs from other relation
	if expr.AttributeIdNm.Status != pgtype.Present {

		// from other relation, collect tupel IDs in relationship with given index tupel
		*inSelect = append(*inSelect, fmt.Sprintf(`(
			SELECT JSON_AGG(id)
			FROM "%s"."%s"
			WHERE "%s"."%s" = "%s"."%s"
		) AS %s`,
			shipMod.Name, shipRel.Name,
			shipRel.Name, atr.Name, relCode, lookups.PkName,
			codeSelect))

	} else {
		shipAtrNm, exists := cache.AttributeIdMap[expr.AttributeIdNm.Bytes]
		if !exists {
			return errors.New("attribute does not exist")
		}

		// from other relation, collect tupel IDs from n:m relationship attribute
		*inSelect = append(*inSelect, fmt.Sprintf(`(
			SELECT JSON_AGG(%s)
			FROM "%s"."%s"
			WHERE "%s"."%s" = "%s"."%s"
		) AS %s`,
			shipAtrNm.Name,
			shipMod.Name, shipRel.Name,
			shipRel.Name, atr.Name, relCode, lookups.PkName,
			codeSelect))
	}
	return nil
}

func joinRelation(mapIndex_relId map[int]uuid.UUID, rel types.DataGetJoin,
	inJoin *[]string, nestingLevel int) error {

	// check join attribute
	atr, exists := cache.AttributeIdMap[rel.AttributeId]
	if !exists {
		return errors.New("join attribute does not exist")
	}

	if atr.RelationshipId.Status != pgtype.Present {
		return errors.New("relationship of attribute is invalid")
	}

	// is join attribute on source relation? (direction of relationship)
	var relIdTarget uuid.UUID // relation ID that is to be joined
	var relIdSource = mapIndex_relId[rel.IndexFrom]
	var relCodeSource = getRelationCode(rel.IndexFrom, nestingLevel)
	var relCodeTarget = getRelationCode(rel.Index, nestingLevel) // relation code that is to be joined
	var relCodeFrom string                                       // relation code of where join attribute is from
	var relCodeTo string                                         // relation code of where join attribute is pointing to

	if atr.RelationId == relIdSource {
		// join attribute comes from source relation, other relation is defined in relationship
		relCodeFrom = relCodeSource
		relCodeTo = relCodeTarget
		relIdTarget = atr.RelationshipId.Bytes
	} else {
		// join attribute comes from other relation, other relation is the source relation for this join
		relCodeFrom = relCodeTarget
		relCodeTo = relCodeSource
		if !exists {
			return errors.New("relation does not exist")
		}
		relIdTarget = atr.RelationId
	}

	mapIndex_relId[rel.Index] = relIdTarget

	// check other relation and corresponding module
	relTarget, exists := cache.RelationIdMap[relIdTarget]
	if !exists {
		return errors.New("relation does not exist")
	}

	modTarget, exists := cache.ModuleIdMap[relTarget.ModuleId]
	if !exists {
		return errors.New("module does not exist")
	}

	// define JOIN type
	if !tools.StringInSlice(rel.Connector, types.QueryJoinConnectors) {
		return errors.New("invalid join type")
	}

	*inJoin = append(*inJoin, fmt.Sprintf("\n"+`%s JOIN "%s"."%s" AS "%s" ON "%s"."%s" = "%s"."%s"`,
		rel.Connector, modTarget.Name, relTarget.Name, relCodeTarget,
		relCodeFrom, atr.Name,
		relCodeTo, lookups.PkName))

	return nil
}

// fills WHERE string from data GET request filters and returns count of arguments
func buildWhere(filters []types.DataGetFilter, queryArgs *[]interface{},
	queryCountArgs *[]interface{}, loginId int64, nestingLevel int, where *string) error {

	bracketBalance := 0
	inWhere := make([]string, 0)

	for i, filter := range filters {

		// overwrite first filter connector and add brackets in first and last filter line
		// done so that query filters do not interfere with other filters
		if i == 0 {
			filter.Connector = "AND"
			filter.Side0.Brackets++
		}
		if i == len(filters)-1 {
			filter.Side1.Brackets++
		}

		if !tools.StringInSlice(filter.Connector, types.QueryFilterConnectors) {
			return errors.New("bad filter connector")
		}
		if !tools.StringInSlice(filter.Operator, types.QueryFilterOperators) {
			return errors.New("bad filter operator")
		}

		bracketBalance -= filter.Side0.Brackets
		bracketBalance += filter.Side1.Brackets
		isNullOp := isNullOperator(filter.Operator)

		// define comparisons
		var getComp = func(s types.DataGetFilterSide, comp *string) error {
			var err error
			var isQuery = s.Query.RelationId != uuid.Nil

			// sub query filter
			if isQuery {
				subQuery, _, err := prepareQuery(s.Query, queryArgs,
					queryCountArgs, loginId, nestingLevel+1)

				if err != nil {
					return err
				}

				*comp = fmt.Sprintf("(\n%s\n)", subQuery)
				return nil
			}

			// attribute filter
			if s.AttributeId.Status == pgtype.Present {
				*comp, err = getAttributeCode(s.AttributeId.Bytes,
					getRelationCode(s.AttributeIndex, s.AttributeNested))

				if err != nil {
					return err
				}

				// special case: (I)LIKE comparison needs attribute cast as TEXT
				// this is relevant for integers/floats/etc.
				if isLikeOperator(filter.Operator) {
					*comp = fmt.Sprintf("%s::TEXT", *comp)
				}
				return nil
			}

			// user value filter
			// can be anything, text, numbers, floats, boolean, NULL values
			// create placeholders and add to query arguments

			if isNullOp {
				// do not add user value as argument if NULL operator is used
				// to use NULL operator the data type must be known ahead of time (prepared statement)
				//  "pg: could not determine data type"
				// because user can add anything we would check the type ourselves
				//  or just check for NIL because that´s all we care about in this case
				if s.Value == nil {
					*comp = "NULL"
					return nil
				} else {
					*comp = "NOT NULL"
					return nil
				}
			}

			if isLikeOperator(filter.Operator) {
				// special syntax for ILIKE comparison (add wildcard characters)
				s.Value = fmt.Sprintf("%%%s%%", s.Value)
			}

			// PGX fix: cannot use proper true/false values in SQL parameters
			// no good solution found so far, error: 'cannot convert (true|false) to Text'
			if fmt.Sprintf("%T", s.Value) == "bool" {
				if s.Value.(bool) == true {
					s.Value = "true"
				} else {
					s.Value = "false"
				}
			}

			*queryArgs = append(*queryArgs, s.Value)
			if queryCountArgs != nil {
				*queryCountArgs = append(*queryCountArgs, s.Value)
			}

			if isArrayOperator(filter.Operator) {
				*comp = fmt.Sprintf("($%d)", len(*queryArgs))
			} else {
				*comp = fmt.Sprintf("$%d", len(*queryArgs))
			}
			return nil
		}

		// build left/right comparison sides (ignore right side, if NULL operator)
		comp0, comp1 := "", ""
		if err := getComp(filter.Side0, &comp0); err != nil {
			return err
		}
		if !isNullOp {
			if err := getComp(filter.Side1, &comp1); err != nil {
				return err
			}
		}

		// generate WHERE line from parsed filter definition
		line := fmt.Sprintf("\n%s %s%s %s %s%s", filter.Connector,
			getBrackets(filter.Side0.Brackets, false),
			comp0, filter.Operator, comp1,
			getBrackets(filter.Side1.Brackets, true))

		inWhere = append(inWhere, line)
	}
	if bracketBalance != 0 {
		return errors.New("bracket count is unequal")
	}

	// join lines and replace first AND with WHERE
	*where = strings.Replace(strings.Join(inWhere, ""), "AND", "WHERE", 1)
	return nil
}

func buildOrderLimitOffset(data types.DataGet, nestingLevel int,
	order *string, limit *string, offset *string) error {

	// build order by line
	orderItems := make([]string, len(data.Orders))
	var codeSelect string
	var err error

	for i, ord := range data.Orders {

		if ord.AttributeId.Status == pgtype.Present {

			// order by attribute, check for use as an expression
			// expressions can be grouped/aggregated, in this case alias is required to order by
			expressionPosAlias := -1
			for i, expr := range data.Expressions {

				if expr.AttributeId.Bytes == ord.AttributeId.Bytes && expr.Index == int(ord.Index.Int) {
					if expr.Aggregator.Status == pgtype.Present || expr.GroupBy {
						expressionPosAlias = i
					}
					break
				}
			}

			if expressionPosAlias != -1 {
				codeSelect = getExpressionCodeSelect(expressionPosAlias)
			} else {
				codeSelect, err = getAttributeCode(ord.AttributeId.Bytes,
					getRelationCode(int(ord.Index.Int), nestingLevel))

				if err != nil {
					return err
				}
			}

		} else if ord.ExpressionPos.Status == pgtype.Present {
			// order by chosen expression (by position in array)
			codeSelect = getExpressionCodeSelect(int(ord.ExpressionPos.Int))
		} else {
			return errors.New("unknown data GET order parameter")
		}

		if ord.Ascending == true {
			orderItems[i] = fmt.Sprintf("%s ASC", codeSelect)
		} else {
			orderItems[i] = fmt.Sprintf("%s DESC NULLS LAST", codeSelect)
		}
	}

	if len(orderItems) != 0 {
		*order = fmt.Sprintf("\nORDER BY %s", strings.Join(orderItems, ", "))
	}
	if data.Limit != 0 {
		*limit = fmt.Sprintf("\nLIMIT %d", data.Limit)
	}
	if data.Offset != 0 {
		*offset = fmt.Sprintf("\nOFFSET %d", data.Offset)
	}
	return nil
}

// helpers

// relation codes exist to uniquely reference a joined relation, even if the same relation is joined multiple times
// example: relation 'person' can be joined twice as '_r0' and '_r1' as 'person' can be joined to itself as 'supervisor to'
// a relation is referenced by '_r' + an integer (relation join index) + optionally '_l' + an integer for nesting (if sub query)
// '_' prefix is protected (cannot be used for entity names)
func getRelationCode(relationIndex int, nestingLevel int) string {
	if nestingLevel == 0 {
		return fmt.Sprintf("_r%d", relationIndex)
	}
	return fmt.Sprintf("_r%d_l%d", relationIndex, nestingLevel)
}

// tupel IDs are uniquely identified by the relation code + the fixed string 'id'
func getTupelIdCode(relationIndex int, nestingLevel int) string {
	return fmt.Sprintf("%sid", getRelationCode(relationIndex, nestingLevel))
}

// an attribute is referenced by the relation code + the attribute name
// due to the relation code, this will always uniquely identify an attribute from a specific index
// example: _r3.surname maps to person.surname from index 3
func getAttributeCode(attributeId uuid.UUID, relCode string) (string, error) {
	atr, exists := cache.AttributeIdMap[attributeId]
	if !exists {
		return "", errors.New("attribute does not exist")
	}
	return fmt.Sprintf(`"%s"."%s"`, relCode, atr.Name), nil
}

// alias for SELECT expression
// set for all expressions, needed for grouped/aggregated/sub query expressions
func getExpressionCodeSelect(expressionPos int) string {
	return fmt.Sprintf(`"_e%d"`, expressionPos)
}

func getBrackets(count int, right bool) string {
	if count == 0 {
		return ""
	}

	bracketChar := "("
	if right {
		bracketChar = ")"
	}

	out := ""
	for count > 0 {
		out += bracketChar
		count--
	}
	return fmt.Sprintf("%s", out)
}

// operator types
func isArrayOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"= ANY", "<> ALL"})
}
func isLikeOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"LIKE", "ILIKE", "NOT LIKE", "NOT ILIKE"})
}
func isNullOperator(operator string) bool {
	return tools.StringInSlice(operator, []string{"IS NULL", "IS NOT NULL"})
}