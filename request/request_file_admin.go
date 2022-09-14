package request

import (
	"encoding/json"
	"fmt"
	"r3/db"
	"r3/schema"

	"github.com/gofrs/uuid"
	"github.com/jackc/pgtype"
)

// returns deleted or unassigned files
func FileGet() (interface{}, error) {
	type file struct {
		Id       uuid.UUID   `json:"id"`
		Name     string      `json:"name"`
		Size     int64       `json:"size"`
		Deleted  pgtype.Int8 `json:"deleted"`
		RecordId pgtype.Int8 `json:"recordId"`
	}

	var res struct {
		AttributeIdMapDeleted    map[uuid.UUID][]file `json:"attributeIdMapDeleted"`
		AttributeIdMapUnassigned map[uuid.UUID][]file `json:"attributeIdMapUnassigned"`
	}
	res.AttributeIdMapDeleted = make(map[uuid.UUID][]file)
	res.AttributeIdMapUnassigned = make(map[uuid.UUID][]file)

	attributeIdsFile := make([]uuid.UUID, 0)
	if err := db.Pool.QueryRow(db.Ctx, `
		SELECT ARRAY_AGG(id)
		FROM app.attribute
		WHERE content = 'files'
	`).Scan(&attributeIdsFile); err != nil {
		return nil, err
	}

	for _, atrId := range attributeIdsFile {
		rows, err := db.Pool.Query(db.Ctx, fmt.Sprintf(`
			SELECT id, name, date_delete, record_id, (
				SELECT size_kb
				FROM instance_file."%s"
				WHERE file_id = f.id
				ORDER BY version DESC
				LIMIT 1
			)
			FROM instance_file."%s" AS f
			WHERE date_delete IS NOT NULL -- file deleted
			OR    record_id   IS NULL     -- file not assigned to any record
			ORDER BY date_delete ASC NULLS LAST, name ASC
		`, schema.GetFilesTableNameVersions(atrId), schema.GetFilesTableName(atrId)))
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var f file
			if err := rows.Scan(&f.Id, &f.Name, &f.Deleted, &f.RecordId, &f.Size); err != nil {
				return nil, err
			}

			// record ID assignment is more important than deletion state
			// without record assignment, restoration to the records file attribute is not possible
			if f.RecordId.Status == pgtype.Present {
				if _, exists := res.AttributeIdMapDeleted[atrId]; !exists {
					res.AttributeIdMapDeleted[atrId] = make([]file, 0)
				}
				res.AttributeIdMapDeleted[atrId] = append(res.AttributeIdMapDeleted[atrId], f)
			} else {
				if _, exists := res.AttributeIdMapUnassigned[atrId]; !exists {
					res.AttributeIdMapUnassigned[atrId] = make([]file, 0)
				}
				res.AttributeIdMapUnassigned[atrId] = append(res.AttributeIdMapUnassigned[atrId], f)
			}
		}
		rows.Close()
	}
	return res, nil
}

// removed deletion state from file
// file must still be assigned to a record to be restored to its file attribute
func FileRestore(reqJson json.RawMessage) (interface{}, error) {
	var req struct {
		AttributeId uuid.UUID `json:"attributeId"`
		FileId      uuid.UUID `json:"fileId"`
	}
	if err := json.Unmarshal(reqJson, &req); err != nil {
		return nil, err
	}

	_, err := db.Pool.Exec(db.Ctx, fmt.Sprintf(`
		UPDATE instance_file."%s"
		SET date_delete = NULL
		WHERE id = $1
	`, schema.GetFilesTableName(req.AttributeId)), req.FileId)
	return nil, err
}
