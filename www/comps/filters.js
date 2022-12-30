import MyBuilderQuery from './builder/builderQuery.js';
import MyInputDate    from './inputDate.js';
import {
	getDependentModules,
	getItemTitleColumn,
	getItemTitleNoRelationship
} from './shared/builder.js';
import {
	isAttributeFiles,
	isAttributeString
} from './shared/attribute.js';
import {
	getNestedIndexAttributeIdsByJoins,
	getQueryTemplate
} from './shared/query.js';
export {MyFilters as default};
export {MyFilterBrackets};
export {MyFilterConnector};
export {MyFilterOperator};

let MyFilterBrackets = {
	name:'my-filter-brackets',
	template:`<my-button
		@trigger="add(true)"
		@trigger-right="add(false)"
		:caption="display(1)"
	/>`,
	props:{
		left:      { type:Boolean, required:true },
		modelValue:{ type:Number,  required:true }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		}
	},
	methods:{
		add:function(increase) {
			let v = this.value;
			
			if(increase) v++;
			else         v--;
			
			if(v < 0) v = 3;
			if(v > 3) v = 0;
			
			this.value = v;
		},
		display:function() {
			let out = '';
			let brk = this.left ? '(' : ')';
			
			for(let cnt = this.value; cnt > 0; cnt--) {
				out += brk;
			}
			return out !== '' ? out : '-';
		}
	}
};

let MyFilterOperatorOption = {
	name:'my-filter-operator-option',
	template:`<option :value="value">{{ displayCaption }}</option>`,
	props:{
		builderMode:{ type:Boolean, required:true },
		caption:    { type:String,  required:true },
		value:      { type:String,  required:true }
	},
	computed:{
		displayCaption:(s) => !s.builderMode ? s.caption : s.value
	}
};

let MyFilterOperator = {
	name:'my-filter-operator',
	components:{ MyFilterOperatorOption },
	template:`<select v-model="value">
		<my-filter-operator-option value="="  :caption="capApp.option.operator.eq" :builderMode="builderMode" />
		<my-filter-operator-option value="<>" :caption="capApp.option.operator.ne" :builderMode="builderMode" />
		
		<optgroup v-if="!onlyEquals && !onlyString" :label="capApp.operatorsSize">
			<my-filter-operator-option value="<"  :caption="capApp.option.operator.st" :builderMode="builderMode" />
			<my-filter-operator-option value=">"  :caption="capApp.option.operator.lt" :builderMode="builderMode" />
			<my-filter-operator-option value="<=" :caption="capApp.option.operator.se" :builderMode="builderMode" />
			<my-filter-operator-option value=">=" :caption="capApp.option.operator.le" :builderMode="builderMode" />
		</optgroup>
		
		<optgroup v-if="!onlyEquals && !onlyDates" :label="capApp.operatorsText">
			<my-filter-operator-option value="LIKE"      :caption="capApp.option.operator.like"      :builderMode="builderMode" />
			<my-filter-operator-option value="ILIKE"     :caption="capApp.option.operator.ilike"     :builderMode="builderMode" />
			<my-filter-operator-option value="NOT LIKE"  :caption="capApp.option.operator.not_like"  :builderMode="builderMode" />
			<my-filter-operator-option value="NOT ILIKE" :caption="capApp.option.operator.not_ilike" :builderMode="builderMode" />
		</optgroup>
		
		<optgroup v-if="!onlyEquals" :label="capApp.operatorsNull">
			<my-filter-operator-option value="IS NULL"     :caption="capApp.option.operator.null"     :builderMode="builderMode" />
			<my-filter-operator-option value="IS NOT NULL" :caption="capApp.option.operator.not_null" :builderMode="builderMode" />
		</optgroup>
		
		<optgroup v-if="!onlyEquals && builderMode" :label="capApp.operatorsSets">
			<my-filter-operator-option value="= ANY"  caption="= ANY"  :builderMode="builderMode" />
			<my-filter-operator-option value="<> ALL" caption="<> ALL" :builderMode="builderMode" />
		</optgroup>
		
		<optgroup v-if="!onlyEquals && builderMode" :label="capApp.operatorsArray">
			<my-filter-operator-option value="@>" caption="@>" :builderMode="builderMode" />
			<my-filter-operator-option value="<@" caption="<@" :builderMode="builderMode" />
			<my-filter-operator-option value="&&" caption="&&" :builderMode="builderMode" />
		</optgroup>
	</select>`,
	watch:{
		onlyDates:function(v) {
			if(v && (this.value === 'ILIKE' || this.value === 'LIKE'))
				this.$emit('update:modelValue','=');
		}
	},
	props:{
		builderMode:{ type:Boolean, required:true },                 // only show in Builder mode (e. g. not for regular users)
		modelValue: { type:String,  required:true },
		onlyDates:  { type:Boolean, required:false, default:false }, // only show operators that can be used for date values (e. g. unix time)
		onlyEquals: { type:Boolean, required:false, default:false }, // only show equal/non-equal operators
		onlyString: { type:Boolean, required:false, default:false }  // only show string operators
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		capApp:(s) => s.$store.getters.captions.filter
	}
};

let MyFilterConnector = {
	name:'my-filter-connector',
	template:`<select class="and" :disabled="readonly" v-model="value">
		<option value="AND">{{ capApp.option.connector.AND }}</option>
		<option value="OR">{{ capApp.option.connector.OR }}</option>
	</select>`,
	props:{
		modelValue:{ type:String,  required:true },
		readonly:  { type:Boolean, required:false, default:false }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		capApp:(s) => s.$store.getters.captions.filter
	}
};

let MyFilterAttribute = {
	name:'my-filter-attribute',
	template:`<select v-model="value">
		
		<option
			v-if="!groupQueries"
			v-for="nia in nestedIndexAttributeIds"
			:value="nia"
		>
			{{ getAttributeCaption(nia) }}
		</option>
		
		<optgroup v-if="groupQueries" v-for="n in nestingLevels" :label="getQueryLabel(n-1)">
			<option
				v-for="nia in nestedIndexAttributeIds.filter(v => v.substring(0,1) === String(n-1))"
				:value="nia"
			>
				{{ getAttributeCaption(nia) }}
			</option>
		</optgroup>
	</select>`,
	props:{
		columnsMode:   { type:Boolean, required:true },
		groupQueries:  { type:Boolean, required:false, default:false },
		modelValue:    { type:String,  required:true },
		nestingLevels: { type:Number,  required:true },
		nestedIndexAttributeIds:{ type:Array, required:true }
	},
	emits:['update:modelValue'],
	computed:{
		value:{
			get()  { return this.modelValue; },
			set(v) { this.$emit('update:modelValue',v); }
		},
		
		// stores
		relationIdMap: (s) => s.$store.getters['schema/relationIdMap'],
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.filter,
		moduleLanguage:(s) => s.$store.getters.moduleLanguage
	},
	methods:{
		// externals
		getItemTitleNoRelationship,
		
		// presentation
		getAttributeCaption(nestedIndexAttributeId) {
			let v   = nestedIndexAttributeId.split('_');
			let atr = this.attributeIdMap[v[2]];
			
			if(this.columnsMode) {
				// 1st preference: dedicated attribute title
				if(typeof atr.captions.attributeTitle[this.moduleLanguage] !== 'undefined')
					return atr.captions.attributeTitle[this.moduleLanguage];
				
				// if nothing else is available: attribute name
				return atr.name;
			}
			
			let rel = this.relationIdMap[atr.relationId];
			return this.getItemTitleNoRelationship(rel,atr,v[1]);
		},
		getQueryLabel(nestingLevel) {
			if(nestingLevel === 0)
				return this.capApp.nestingMain;
			
			return this.capApp.nestingSub + ' ' + nestingLevel;
		}
	}
};

let MyFilterSide = {
	name:'my-filter-side',
	components:{
		MyBuilderQuery,
		MyFilterAttribute,
		MyInputDate
	},
	template:`<div class="filter-side">
		<div class="filter-side-inputs default-inputs">
			<template v-if="!isNullPartner">
				
				<!-- content input -->
				<select
					v-if="!columnsMode"
					@input="setContent"
					:value="content"
				>
					<option
						v-for="c in contentEnabled"
						:disabled="contentUnusable.includes(c)"
						:title="capApp.option.contentHint[c]"
						:value="c"
					>
						{{ capApp.option.content[c] }}
					</option>
				</select>
				
				<!-- sub query show toggle -->
				<my-button
					v-if="isSubQuery"
					@trigger="showQuery = !showQuery"
					:captionTitle="capApp.queryShow"
					:image="!showQuery ? 'visible0.png' : 'visible1.png'"
				/>
				
				<!-- nested index attribute input -->
				<my-filter-attribute
					v-if="isAttribute"
					v-model="nestedIndexAttribute"
					:columnsMode="columnsMode"
					:groupQueries="nestingLevels !== 0 && !isSubQuery && builderMode"
					:nestedIndexAttributeIds="!isSubQuery ? nestedIndexAttributeIds : nestedIndexAttributeIdsSubQuery"
					:nestingLevels="nestingLevels"
				/>
				
				<!-- collection input -->
				<select v-model="collectionId" v-if="!columnsMode && isCollection">
					<option :value="null">-</option>
					<optgroup
						v-for="m in getDependentModules(module,modules).filter(v => v.collections.length !== 0)"
						:label="m.name"
					>
						<option v-for="c in m.collections" :value="c.id">
							{{ c.name }}
						</option>
					</optgroup>
				</select>
				
				<!-- collection column input -->
				<select v-model="columnId" v-if="!columnsMode && isCollection && collectionId !== null">
					<option :value="null">-</option>
					<option v-for="c in collectionIdMap[collectionId].columns" :value="c.id">
						{{ getItemTitleColumn(c,true) }}
					</option>
				</select>
				
				<!-- field input -->
				<select v-model="fieldId" v-if="!columnsMode && isField">
					<template v-for="(ref,fieldId) in entityIdMapRef.field">
						<option
							v-if="fieldIdMap[fieldId].content === 'data'"
							:disabled="fieldId.startsWith('new')"
							:value="fieldId"
						>F{{ fieldId.startsWith('new') ? ref + ' (' + capGen.notSaved + ')' : ref }}</option>
					</template>
				</select>
				
				<!-- preset input -->
				<select v-model="presetId" v-if="!columnsMode && isPreset">
					<option :value="null"></option>
					<optgroup
						v-for="r in module.relations.filter(v => v.presets.length !== 0)"
						:label="r.name"
					>
						<option v-for="p in r.presets.filter(v => v.protected)" :value="p.id">
							{{ p.name }}
						</option>
					</optgroup>
				</select>
				
				<!-- role input -->
				<select v-model="roleId" v-if="!columnsMode && isRole">
					<option :value="null"></option>
					<option v-for="r in module.roles" :value="r.id">
						{{ r.name }}
					</option>
				</select>
				
				<!-- fixed value input -->
				<template v-if="isValue || isJavascript">
					<input placeholder="..."
						v-if="!columnDate && !columnTime"
						@keyup.enter="$emit('apply-value')"
						v-model="valueFixText"
						:placeholder="isValue ? capApp.valueHint : capApp.javascriptHint"
					/>
					
					<div class="input-custom date-wrap" v-if="columnDate || columnTime">
						<my-input-date
							@set-unix-from="valueFixTextDate = $event"
							:isDate="columnDate"
							:isTime="columnTime"
							:unixFrom="valueFixTextDate"
						/>
					</div>
				</template>
			</template>
		</div>
		
		<!-- sub query inputs -->
		<div class="subQuery shade" v-if="isSubQuery && showQuery">
			<table class="default-inputs">
				<tr>
					<td>{{ capApp.subQueryAttribute }}</td>
					<td>
						<!-- sub query attribute input -->
						<my-filter-attribute
							v-model="nestedIndexAttribute"
							:columnsMode="columnsMode"
							:groupQueries="nestingLevels !== 0 && !isSubQuery && builderMode"
							:nestedIndexAttributeIds="!isSubQuery ? nestedIndexAttributeIds : nestedIndexAttributeIdsSubQuery"
							:nestingLevels="nestingLevels"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.subQueryAggregator }}</td>
					<td>
						<!-- sub query aggregator input -->
						<select v-model="queryAggregator">
							<option value=""     >-</option>
							<option value="array">{{ capGen.option.aggArray }}</option>
							<option value="avg"  >{{ capGen.option.aggAvg }}</option>
							<option value="count">{{ capGen.option.aggCount }}</option>
							<option value="json" >{{ capGen.option.aggJson }}</option>
							<option value="list" >{{ capGen.option.aggList }}</option>
							<option value="max"  >{{ capGen.option.aggMax }}</option>
							<option value="min"  >{{ capGen.option.aggMin }}</option>
							<option value="sum"  >{{ capGen.option.aggSum }}</option>
						</select>
					</td>
				</tr>
			</table>
			
			<!-- filter sub query -->
			<my-builder-query
				@set-choices="setQuery('choices',$event)"
				@set-filters="setQuery('filters',$event)"
				@set-fixed-limit="setQuery('fixedLimit',$event)"
				@set-lookups="setQuery('lookups',$event)"
				@set-joins="setQuery('joins',$event)"
				@set-orders="setQuery('orders',$event)"
				@set-relation-id="setQuery('relationId',$event)"
				:allowChoices="false"
				:allowOrders="true"
				:choices="query.choices"
				:entityIdMapRef="entityIdMapRef"
				:fieldIdMap="fieldIdMap"
				:filters="query.filters"
				:fixedLimit="query.fixedLimit"
				:joins="query.joins"
				:joinsParents="joinsParents.concat([joins])"
				:lookups="query.lookups"
				:moduleId="moduleId"
				:orders="query.orders"
				:relationId="query.relationId"
			/>
		</div>
	</div>`,
	props:{
		builderMode:   { type:Boolean, required:true },
		columnDate:    { type:Boolean, required:false, default:false },
		columnTime:    { type:Boolean, required:false, default:false },
		columnsMode:   { type:Boolean, required:true },
		disableContent:{ type:Array,   required:true },
		entityIdMapRef:{ type:Object,  required:true },
		fieldIdMap:    { type:Object,  required:true },
		isNullOperator:{ type:Boolean, required:true },
		joins:         { type:Array,   required:true },
		joinsParents:  { type:Array,   required:true },
		leftSide:      { type:Boolean, required:true },
		modelValue:    { type:Object,  required:true },
		moduleId:      { type:String,  required:true },
		nestedIndexAttributeIds:{ type:Array, required:true },
		nestingLevels: { type:Number,  required:true }
	},
	emits:['apply-value','update:modelValue'],
	data:function() {
		return {
			showQuery:false // show existing sub query
		};
	},
	computed:{
		// entities
		contentEnabled:(s) => {
			return [
				'attribute','field','fieldChanged','value','record',
				'recordNew','login','preset','role','languageCode',
				'javascript','true','collection','subQuery'
			].filter(v => !s.disableContent.includes(v));
		},
		contentUnusable:(s) => {
			let out = [];
			if(Object.keys(s.fieldIdMap).length === 0) {
				out.push('field');
				out.push('fieldChanged');
			}
			return out;
		},
		nestedIndexAttributeIdsSubQuery:(s) => {
			if(!s.isSubQuery) return [];
			
			return s.getNestedIndexAttributeIdsByJoins(
				s.query.joins,
				s.joinsParents.length,
				false
			);
		},
		
		// inputs
		brackets:{
			get()  { return this.modelValue.brackets; },
			set(v) { this.set('brackets',v); }
		},
		content:{ // getter only
			get() { return this.modelValue.content; }
		},
		collectionId:{
			get()  { return this.modelValue.collectionId; },
			set(v) { this.set('collectionId',v); }
		},
		columnId:{
			get()  { return this.modelValue.columnId; },
			set(v) { this.set('columnId',v); }
		},
		fieldId:{
			get()  { return this.modelValue.fieldId; },
			set(v) { this.set('fieldId',v); }
		},
		nestedIndexAttribute:{
			get()  {
				return `${this.modelValue.attributeNested}`+
					`_${this.modelValue.attributeIndex}`+
					`_${this.modelValue.attributeId}`;
			},
			set(v) {
				if(typeof v === 'undefined')
					return;
				
				let vs = v.split('_');
				this.setAttribute(vs[2],parseInt(vs[1]),parseInt(vs[0]));
			}
		},
		presetId:{
			get()  { return this.modelValue.presetId; },
			set(v) { this.set('presetId',v); }
		},
		query:{
			get()  { return this.modelValue.query; },
			set(v) { this.set('query',v); }
		},
		queryAggregator:{
			get()  { let v = this.modelValue.queryAggregator; return v !== null ? v : ''; },
			set(v) { this.set('queryAggregator',v === '' ? null : v); }
		},
		roleId:{
			get()  { return this.modelValue.roleId; },
			set(v) { this.set('roleId',v); }
		},
		valueFixText:{
			get()  { return this.modelValue.value; },
			set(v) { this.set('value',v); }
		},
		valueFixTextDate:{
			get()  { return this.valueFixText === '' ? null : this.valueFixText; },
			set(v) {
				if(v === null) v = '';
				this.valueFixText = String(v);
			}
		},
		
		// simple
		module:(s) => s.moduleId === '' ? false : s.moduleIdMap[s.moduleId],
		
		// states
		isAttribute:  (s) => s.content === 'attribute',
		isCollection: (s) => s.content === 'collection',
		isField:      (s) => s.content === 'field' || s.content === 'fieldChanged',
		isJavascript: (s) => s.content === 'javascript',
		isPreset:     (s) => s.content === 'preset',
		isRole:       (s) => s.content === 'role',
		isSubQuery:   (s) => s.content === 'subQuery',
		isValue:      (s) => s.content === 'value',
		isNullPartner:(s) => !s.leftSide && s.isNullOperator,
		
		// stores
		modules:        (s) => s.$store.getters['schema/modules'],
		moduleIdMap:    (s) => s.$store.getters['schema/moduleIdMap'],
		collectionIdMap:(s) => s.$store.getters['schema/collectionIdMap'],
		capApp:         (s) => s.$store.getters.captions.filter,
		capGen:         (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getDependentModules,
		getItemTitleColumn,
		getNestedIndexAttributeIdsByJoins,
		getQueryTemplate,
		
		// actions
		set(name,newValue) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v[name] = newValue;
			this.$emit('update:modelValue',v);
		},
		setAttribute(attributeId,index,nested) {
			let v = JSON.parse(JSON.stringify(this.modelValue));
			v.attributeId     = attributeId;
			v.attributeIndex  = index;
			v.attributeNested = nested;
			this.$emit('update:modelValue',v);
		},
		setContent(evt) {
			let v     = JSON.parse(JSON.stringify(this.modelValue));
			v.content = evt.target.value;
			
			// clean up content related values
			if(v.content !== 'attribute') {
				v.attributeId     = null;
				v.attributeIndex  = 0;
				v.attributeNested = 0;
			}
			
			// remove invalid references
			if(v.content !== 'collection') {
				v.collectionId = null;
				v.columnId     = null;
			}
			if(v.content !== 'field' && v.content !== 'fieldChanged')
				v.fieldId  = null;
			
			if(v.content !== 'preset') v.presetId = null;
			if(v.content !== 'role')   v.roleId   = null; 
			if(v.content !== 'value')  v.value    = null;
			
			if(v.content !== 'subQuery') {
				v.query           = null;
				v.queryAggregator = null;
			}
			else {
				v.query = this.getQueryTemplate();
				this.showQuery = true;
			}
			this.$emit('update:modelValue',v);
		},
		setQuery(name,newValue) {
			let v = JSON.parse(JSON.stringify(this.modelValue.query));
			v[name] = newValue;
			this.set('query',v);
		}
	}
};

let MyFilter = {
	name:'my-filter',
	components:{
		MyFilterBrackets,
		MyFilterConnector,
		MyFilterOperator,
		MyFilterSide
	},
	template:`<div class="filter">
		<img v-if="expertMode" class="dragAnchor" src="images/drag.png" />
		<my-filter-connector class="connector"
			v-model="connectorInput"
			:readonly="position === 0"
		/>
		<my-filter-brackets class="brackets"
			v-if="expertMode"
			v-model="brackets0Input"
			:left="true"
		/>
		<my-filter-side
			v-model="side0Input"
			@apply-value="$emit('apply-value')"
			:builderMode="builderMode"
			:columnsMode="columnsMode"
			:disableContent="disableContent"
			:entityIdMapRef="entityIdMapRef"
			:fieldIdMap="fieldIdMap"
			:isNullOperator="isNullOperator"
			:joins="joins"
			:joinsParents="joinsParents"
			:leftSide="true"
			:moduleId="moduleId"
			:nestedIndexAttributeIds="nestedIndexAttributeIds"
			:nestingLevels="nestingLevels"
		/>
		<my-filter-operator class="operator"
			v-model="operatorInput"
			:builderMode="builderMode"
			:onlyDates="side0ColumDate || side0ColumTime"
			:onlyString="isStringInput"
		/>
		<my-filter-side
			v-model="side1Input"
			@apply-value="$emit('apply-value')"
			:builderMode="builderMode"
			:columnDate="side0ColumDate"
			:columnTime="side0ColumTime"
			:columnsMode="columnsMode"
			:disableContent="disableContent"
			:entityIdMapRef="entityIdMapRef"
			:fieldIdMap="fieldIdMap"
			:isNullOperator="isNullOperator"
			:joins="joins"
			:joinsParents="joinsParents"
			:leftSide="false"
			:moduleId="moduleId"
			:nestedIndexAttributeIds="nestedIndexAttributeIds"
			:nestingLevels="nestingLevels"
		/>
		<my-filter-brackets class="brackets"
			v-if="expertMode"
			v-model="brackets1Input"
			:left="false"
		/>
		<my-button image="delete.png"
			@trigger="$emit('remove',position)"
			:cancel="true"
			:tight="true"
		/>
	</div>`,
	props:{
		builderMode:   { type:Boolean, required:true },
		columns:       { type:Array,   required:false, default:() => [] },
		columnsMode:   { type:Boolean, required:true },
		disableContent:{ type:Array,   required:true },
		entityIdMapRef:{ type:Object,  required:true },
		expertMode:    { type:Boolean, required:true },
		fieldIdMap:    { type:Object,  required:true },
		joins:         { type:Array,   required:true },
		joinsParents:  { type:Array,   required:true },
		moduleId:      { type:String,  required:true },
		nestedIndexAttributeIds:{ type:Array, required:true },
		nestingLevels: { type:Number,  required:true },
		
		// filter inputs
		connector:{ type:String, required:true },
		operator: { type:String, required:true },
		position: { type:Number, required:true },
		side0:    { type:Object, required:true },
		side1:    { type:Object, required:true }
	},
	emits:['apply-value','remove','update'],
	computed:{
		// inputs
		brackets0Input:{
			get() { return this.side0.brackets; },
			set(vNew) {
				let v = JSON.parse(JSON.stringify(this.side0));
				v.brackets = vNew;
				this.side0Input = v;
			}
		},
		brackets1Input:{
			get() { return this.side1.brackets; },
			set(vNew) {
				let v = JSON.parse(JSON.stringify(this.side1));
				v.brackets = vNew;
				this.side1Input = v;
			}
		},
		connectorInput:{
			get()  { return this.connector; },
			set(v) { this.$emit('update',this.position,'connector',v); }
		},
		operatorInput:{
			get()  { return this.operator; },
			set(v) { this.$emit('update',this.position,'operator',v); }
		},
		side0Input:{
			get()  { return this.side0; },
			set(v) { this.$emit('update',this.position,'side0',v); }
		},
		side1Input:{
			get()  { return this.side1; },
			set(v) { this.$emit('update',this.position,'side1',v); }
		},
		
		// states
		side0Column:(s) => {
			for(let i = 0, j = s.columns.length; i < j; i++) {
				let c = s.columns[i];
				
				if(c.index !== s.side0.attributeIndex || c.attributeId !== s.side0.attributeId)
					continue;
				
				return c;
			}
			return false;
		},
		side0ColumDate:(s) => {
			return ['date','datetime'].includes(s.side0Column.display);
		},
		side0ColumTime:(s) => {
			return ['datetime','time'].includes(s.side0Column.display);
		},
		isNullOperator:(s) => {
			return ['IS NULL','IS NOT NULL'].includes(s.operator);
		},
		isStringInput:(s) => {
			return (
				typeof s.side0.attributeId !== 'undefined' &&
				s.side0.attributeId !== null &&
				s.isAttributeString(s.attributeIdMap[s.side0.attributeId].content)
			) || (
				typeof s.side1.attributeId !== 'undefined' &&
				s.side1.attributeId !== null &&
				s.isAttributeString(s.attributeIdMap[s.side1.attributeId].content)
			);
		},
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap']
	},
	methods:{
		// externals
		isAttributeString
	}
};

let MyFilters = {
	name:'my-filters',
	components:{MyFilter},
	template:`<div class="filters">
		<div class="filter-actions" v-if="nestedIndexAttributeIds.length !== 0">
			<slot name="title" />
			
			<div>
				<my-button
					v-if="anyFilters && !builderMode"
					@trigger="expertMode = !expertMode"
					:caption="capGen.button.expert"
					:image="expertMode ? 'checkbox1.png' : 'checkbox0.png'"
					:naked="true"
				/>
				<my-button image="add.png"
					v-if="showAdd && !userFilter"
					@trigger="add"
					:caption="capApp.add"
					:naked="true"
				/>
			</div>
		</div>
		
		<draggable handle=".dragAnchor" group="filters" itemKey="id" animation="100"
			@change="set"
			:fallbackOnBody="true"
			:list="filters"
		>
			<template #item="{element,index}">
				<my-filter
					@apply-value="apply"
					@remove="remove"
					@update="setValue"
					:builderMode="builderMode"
					:columns="columns"
					:columnsMode="columnsMode"
					:connector="element.connector"
					:disableContent="disableContent"
					:entityIdMapRef="entityIdMapRef"
					:expertMode="expertMode"
					:fieldIdMap="fieldIdMap"
					:joins="joins"
					:joinsParents="joinsParents"
					:key="index"
					:moduleId="moduleId"
					:nestedIndexAttributeIds="nestedIndexAttributeIds"
					:nestingLevels="joinsParents.length+1"
					:operator="element.operator"
					:position="index"
					:side0="element.side0"
					:side1="element.side1"
				/>
			</template>
		</draggable>
		
		<div class="filter-actions end" v-if="userFilter && nestedIndexAttributeIds.length !== 0">
			<div class="row">
				<my-button image="ok.png"
					@trigger="apply"
					:active="anyFilters && bracketsEqual"
					:caption="capGen.button.apply"
				/>
				<my-button image="add.png"
					v-if="showAdd"
					@trigger="add"
					:caption="capApp.add"
					:naked="false"
				/>
			</div>
			<div class="row">
				<my-button image="delete.png"
					@trigger="removeAll"
					:active="anyFilters"
					:cancel="true"
					:caption="capGen.button.all"
					:captionTitle="capGen.button.reset"
				/>
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:caption="capGen.button.close"
				/>
			</div>
		</div>
	</div>`,
	props:{
		builderMode:   { type:Boolean, required:false, default:false },
		columns:       { type:Array,   required:false, default:() => [] },
		disableContent:{ type:Array,   required:false, default:() => [] }, // content to disable (attribute, record, field, true, ...)
		entityIdMapRef:{ type:Object,  required:false, default:() => {return {}} },
		fieldIdMap:    { type:Object,  required:false, default:() => {return {}} },
		filterAddCnt:  { type:Number,  required:false, default:0 },
		frontendOnly:  { type:Boolean, required:false, default:false },    // filter criteria must not contain backend types (attributes/queries)
		joins:         { type:Array,   required:false, default:() => [] },
		joinsParents:  { type:Array,   required:false, default:() => [] },
		modelValue:    { type:Array,   required:true },
		moduleId:      { type:String,  required:false, default:'' },
		showAdd:       { type:Boolean, required:false, default:true },
		showMove:      { type:Boolean, required:false, default:false },
		showReset:     { type:Boolean, required:false, default:false },
		userFilter:    { type:Boolean, required:false, default:false }     // filter is for end users
	},
	emits:['apply','close','update:modelValue'],
	watch:{
		filterAddCnt() { this.add(); }, // ugly hack to trigger inside this component
		modelValue:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	data() {
		return {
			expertMode:this.builderMode,
			filters:[]
		};
	},
	computed:{
		// states
		bracketsEqual:(s) => {
			let cnt0 = 0;
			let cnt1 = 0;
			for(const f of s.filters) {
				cnt0 += f.side0.brackets;
				cnt1 += f.side1.brackets;
			}
			return cnt0 === cnt1;
		},
		
		// composite ID of
		//  nesting level (0=main query, 1=1st sub query)
		//  relation join index
		//  attribute ID
		nestedIndexAttributeIds:(s) => {
			let out = [];
			
			// columns defined, provide filter criteria based on column attributes
			// used for user filters on list fields
			//  user filters can only ever access main query (no access to sub queries)
			if(s.columnsMode) {
				for(const col of s.columns) {
					const atr = s.attributeIdMap[col.attributeId];
					
					if(col.subQuery || (col.aggregator !== null && col.aggregator !== 'record'))
						continue;
					
					if(s.isAttributeFiles(atr.content) || atr.encrypted)
						continue;
					
					out.push(`0_${col.index}_${atr.id}`);
				}
				return out;
			}
			
			// no columns defined, provide filter criteria based on attributes from joined relation
			//  as filters can be used in sub queries, we access all joins from all parent queries
			// used for pre-defining list filters for queries
			out = s.getNestedIndexAttributeIdsByJoins(s.joins,s.joinsParents.length,false);
			for(let i = 0, j = s.joinsParents.length; i < j; i++) {
				out = out.concat(s.getNestedIndexAttributeIdsByJoins(s.joinsParents[i],i,false));
			}
			return out;
		},
		
		// simple states
		anyFilters: (s) => s.filters.length !== 0,
		columnsMode:(s) => s.columns.length !== 0,
		
		// stores
		attributeIdMap:(s) => s.$store.getters['schema/attributeIdMap'],
		capApp:        (s) => s.$store.getters.captions.filter,
		capGen:        (s) => s.$store.getters.captions.generic
	},
	methods:{
		// externals
		getNestedIndexAttributeIdsByJoins,
		isAttributeFiles,
		
		reset() {
			this.filters = JSON.parse(JSON.stringify(this.modelValue));
		},
		
		// actions
		add() {
			let v = {
				connector:'AND',
				operator:'ILIKE',
				side0:{
					brackets:0,
					collectionId:null,
					columnId:null,
					content:'field',
					fieldId:null,
					presetId:null,
					roleId:null,
					value:''
				},
				side1:{
					brackets:0,
					collectionId:null,
					columnId:null,
					content:'value',
					fieldId:null,
					presetId:null,
					roleId:null,
					value:''
				}
			};
			
			if(!this.frontendOnly) {
				// add first available attribute as left side filter value
				let p = this.nestedIndexAttributeIds[0].split('_');
				v.side0.attributeId     = p[2];
				v.side0.attributeIndex  = parseInt(p[1]);
				v.side0.attributeNested = parseInt(p[0]);
				v.side0.content         = 'attribute';
				v.side0.query           = null;
				v.side0.queryAggregator = null;
				v.side1.attributeId     = null;
				v.side1.attributeIndex  = 0;
				v.side1.attributeNested = 0;
				v.side1.query           = null;
				v.side1.queryAggregator = null;
			}
			this.filters.push(v);
			this.set();
		},
		apply() {
			if(this.bracketsEqual)
				this.$emit('apply');
		},
		remove(position) {
			this.filters.splice(position,1);
			this.set();
			
			// inform parent when filter has been reset
			if(this.filters.length === 0)
				this.$emit('apply');
		},
		removeAll() {
			this.filters = [];
			this.set();
			this.$emit('apply');
		},
		set() {
			// overwrite first filter with only valid connector
			if(this.filters.length > 0)
				this.filters[0].connector = 'AND';
			
			this.$emit('update:modelValue',JSON.parse(JSON.stringify(this.filters)));
		},
		setValue(position,name,value) {
			this.filters[position][name] = value;
			this.set();
		}
	}
};