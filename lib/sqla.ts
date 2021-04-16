import { safety } from "./deps.ts";
import * as interp from "./interpolate.ts";

// TODO: add typesafe SQL 'create comment' statements for Postgraphile configuration
// e.g.: comment on table periodical_nature is E'@name periodical_nature\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

export interface DcpTemplateLiteral {
  (
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): DcpInterpolationResult;
}

export interface DcpInterpolationOptions extends interp.InterpolationOptions {
  readonly prependHeaders: boolean;
}

/**
 * Creates a SQL template tag which can be "executed" in the given context 
 * with a local state. The special 'SQL' name is used by some Visual Studio
 * Code extensions to do code highlighting and error detection inside template
 * literal so it's worth creating a wrapper around executeTemplate which is
 * generic.
 * @param ctx is the context that all templates can use across invocations
 * @param state is the "local" state of a single interpolation
 * @returns the interpolated template text
 */
export function SQL(
  ctx: DcpInterpolationContext,
  state: DcpTemplateState,
  options: DcpInterpolationOptions = { prependHeaders: true },
): DcpTemplateLiteral {
  return (literals: TemplateStringsArray, ...expressions: unknown[]) => {
    let interpolated = "";
    if (isDcpTemplateState(state)) {
      if (state.headers.length > 0) {
        const { indent } = state.indentation;
        interpolated = state.headers.map((h) => {
          return indent(h(state));
        }).join("\n") + "\n" + interpolated;
      }
    }
    for (let i = 0; i < expressions.length; i++) {
      interpolated += literals[i];
      interpolated += expressions[i];
    }
    interpolated += literals[literals.length - 1];
    const base = ctx.engine.prepareResult(interpolated, state, options);
    return {
      ...base,
      ctx,
    };
  };
}

export type SqlStatement = string;
export type SqlAffinityGroupName = string;
export type SqlAffinityAncestorizedGroupName = string;
export type SqlTableName = string;
export type SqlTableColumnName = string;
export type SqlTableColumnNameSupplier = (
  suggested?: SqlTableColumnName,
) => SqlTableColumnName;
export type SqlTableColumnNameFlexible =
  | SqlTableColumnName
  | SqlTableColumnNameSupplier;
export type SqlTableColumnQualifiedName = string;
export type SqlTableCreateDeclFragment = string;
export type SqlTableConstraintName = string;
export type SqlTableIndexName = string;
export type SqlTableColumnForeignKeyExpr = string;
export type SqlViewName = string;
export type PostgreSqlStatement = SqlStatement;
export type PostgreSqlStoredRoutineName = string;
export type PostgreSqlStoredRoutineQualifiedName = string;
export type PostgreSqlStoredRoutineBodyCodeBlockName = string;
export type PostgreSqlSchemaName = string;
export type PostgreSqlSchemaTableQualifiedName = string;
export type PostgreSqlSchemaViewQualifiedName = string;
export type PostgreSqlSchemaTableColumnQualifiedName = string;
export type PostgreSqlExtensionName = string;
export type PostgreSqlDomainName = string;
export type PostgreSqlDomainDataType = string;
export type PostgreSqlDomainDefaultExpr = string;
export type PostgreSqlDomainQualifiedName = string;
export type PostgreSqlDomainCastExpr = string;
export type PostgreSqlOperatorExpr = string;
export type PostgreSqlCompareColumnExpr = string;

export interface ObservableQualifiedReferenceSupplier {
  (qualify: string): string;
}

export interface QualifiedReferenceSupplier {
  readonly qualifiedReference: ObservableQualifiedReferenceSupplier;
}

export const isQualifiedReferenceSupplier = safety.typeGuard<
  QualifiedReferenceSupplier
>("qualifiedReference");

export interface PostgreSqlStatementSupplier {
  (state: DcpTemplateState): PostgreSqlStatement;
}

export interface PostgreSqlStatementEnhancer {
  (
    suggested: PostgreSqlStatement,
    state: DcpTemplateState,
  ): PostgreSqlStatement;
}

export interface DcpTemplateSupplier {
  (state: DcpTemplateState): string;
}

export interface PostgreSqlExtension {
  readonly name: PostgreSqlExtensionName;
  readonly createSql: PostgreSqlStatementSupplier;
  readonly dropSql: PostgreSqlStatementSupplier;
  readonly searchPath: PostgreSqlSchema[];
}

export interface PostgreSqlOperatorExprs {
  readonly equal: PostgreSqlOperatorExpr;
}

export interface PostgreSqlDomainColumnOptions {
  readonly isNotNullable?: boolean;
  readonly defaultSqlExpr?: PostgreSqlDomainDefaultExpr;
}

export interface PostgreSqlDomain extends PostgreSqlDomainColumnOptions {
  readonly name: PostgreSqlDomainName;
  readonly qName: PostgreSqlDomainQualifiedName;
  readonly dataType: PostgreSqlDomainDataType;
  readonly defaultColumnName: SqlTableColumnNameFlexible;
  readonly createSql: PostgreSqlStatementSupplier;
  readonly dropSql: PostgreSqlStatementSupplier;
  readonly tableColumn: TypedSqlTableColumnSupplier;
  readonly castSql: (
    expr: PostgreSqlDomainCastExpr,
  ) => PostgreSqlDomainCastExpr;
}

export interface PostgreSqlDomainSupplier {
  (state: DcpTemplateState): PostgreSqlDomain;
}

export interface PostgreSqlDomainReference {
  readonly prime: PostgreSqlDomain;
  readonly reference: PostgreSqlDomain;
}

export interface PostgreSqlDomainReferenceSupplier {
  (
    domain: PostgreSqlDomain,
    state: DcpTemplateState,
  ): PostgreSqlDomainReference;
}

export interface SqlView extends QualifiedReferenceSupplier {
  readonly name: SqlViewName;
  readonly qName: PostgreSqlSchemaViewQualifiedName;
  readonly createSql: PostgreSqlStatementSupplier;
  readonly dropSql: PostgreSqlStatementSupplier;
}

export interface SqlTableLifecycleFunctions {
  readonly upserted: PostgreSqlStoredRoutineSupplier;
  readonly upsert: PostgreSqlStoredRoutineSupplier;
}

export interface SqlTableUpsertable {
  readonly upsertRoutinesSQL: () => DcpInterpolationResult;
}

export const isSqlTableUpsertable = safety.typeGuard<SqlTableUpsertable>(
  "upsertRoutinesSQL",
);

export interface SqlTable extends QualifiedReferenceSupplier {
  readonly name: SqlTableName;
  readonly qName: PostgreSqlSchemaTableQualifiedName;
  readonly createSql: PostgreSqlStatementSupplier;
  readonly dropSql: PostgreSqlStatementSupplier;
  readonly lcFunctions: SqlTableLifecycleFunctions;
}

export interface SqlTableColumnReference {
  readonly table: SqlTable;
  readonly column: SqlTableColumn;
}

export interface SqlTableColumnOptions extends PostgreSqlDomainColumnOptions {
  readonly isPrimaryKey?: boolean;
  readonly foreignKey?: SqlTableColumnReference;
  readonly foreignKeyDecl?: SqlTableColumnForeignKeyExpr;
  readonly tableConstraintsSql?:
    | PostgreSqlStatementSupplier
    | PostgreSqlStatementSupplier[];
  readonly tableIndexesSql?:
    | PostgreSqlStatementSupplier
    | PostgreSqlStatementSupplier[];
  readonly castSql?: (
    expr: PostgreSqlDomainCastExpr,
  ) => PostgreSqlDomainCastExpr;
  readonly operatorSql?: PostgreSqlOperatorExprs;
}

export interface SqlTableColumn extends SqlTableColumnOptions {
  readonly name: SqlTableColumnNameFlexible;
  readonly tableQualifiedName: SqlTableColumnQualifiedName;
  readonly schemaQualifiedName: SqlTableColumnQualifiedName;
  readonly dataType: PostgreSqlDomainDataType;
  readonly tableColumnDeclSql: PostgreSqlStatementSupplier;
  readonly castSql: (
    expr: PostgreSqlDomainCastExpr,
  ) => PostgreSqlDomainCastExpr;
  readonly compareEqualSql: (
    left: SqlTableColumnQualifiedName,
    right: PostgreSqlCompareColumnExpr,
  ) => PostgreSqlCompareColumnExpr;
}

export const isSqlTableColumn = safety.typeGuard<SqlTableColumn>(
  "tableColumnDeclSql",
);

export interface TypedSqlTableColumn extends SqlTableColumn {
  readonly domain: PostgreSqlDomain;
}

export const isTypedSqlTableColumn = safety.typeGuard<TypedSqlTableColumn>(
  "tableColumnDeclSql",
  "domain",
);

export interface SqlTableColumnSupplier {
  (
    table: SqlTable,
    columnName: SqlTableColumnNameFlexible,
    options?: SqlTableColumnOptions,
  ): SqlTableColumn;
}

export interface TypedSqlTableColumnSupplier {
  (
    table: SqlTable,
    options?: SqlTableColumnOptions & {
      columnName?: SqlTableColumnNameFlexible;
    },
  ): TypedSqlTableColumn;
}

export interface PostgreSqlStoredRoutine {
  readonly name: PostgreSqlStoredRoutineName;
  readonly qName: PostgreSqlStoredRoutineQualifiedName;
  readonly bodyBlockName: PostgreSqlStoredRoutineBodyCodeBlockName;
}

export interface PostgreSqlStoredRoutineSupplier {
  (
    state: DcpTemplateState,
    override?: PostgreSqlStoredRoutineName,
  ): PostgreSqlStoredRoutine;
}

export interface PostgreSqlLifecycleFunctions {
  readonly constructDomains: PostgreSqlStoredRoutineSupplier;
  readonly constructStorage: PostgreSqlStoredRoutineSupplier;
  readonly constructIdempotent: PostgreSqlStoredRoutineSupplier;
  readonly constructShield: PostgreSqlStoredRoutineSupplier;
  readonly destroyShield: PostgreSqlStoredRoutineSupplier;
  readonly destroyStorage: PostgreSqlStoredRoutineSupplier;
  readonly destroyIdempotent: PostgreSqlStoredRoutineSupplier;
  readonly deployProvenanceHttpRequest: PostgreSqlStoredRoutineSupplier;
  readonly upgrade: PostgreSqlStoredRoutineSupplier;
  readonly unitTest: PostgreSqlStoredRoutineSupplier;
  readonly lint: PostgreSqlStoredRoutineSupplier;
  readonly doctor: PostgreSqlStoredRoutineSupplier;
  readonly metrics: PostgreSqlStoredRoutineSupplier;
  readonly populateContext: PostgreSqlStoredRoutineSupplier;
  readonly populateSecrets: PostgreSqlStoredRoutineSupplier;
  readonly populateSeedData: PostgreSqlStoredRoutineSupplier;
  readonly populateData: PostgreSqlStoredRoutineSupplier;
}

export interface SqlAffinityGroup extends QualifiedReferenceSupplier {
  readonly name: SqlAffinityGroupName;
  readonly qName: SqlAffinityAncestorizedGroupName;
  readonly setSearchPathSql: PostgreSqlStatementSupplier;
  readonly lcFunctions: PostgreSqlLifecycleFunctions;
}

export interface PostgreSqlSchema extends SqlAffinityGroup {
  readonly name: PostgreSqlSchemaName;
  readonly dependencies?: PostgreSqlSchema[];
  readonly createSchemaSql: PostgreSqlStatementSupplier;
  readonly dropSchemaSql: PostgreSqlStatementSupplier;
  readonly extension: (name: PostgreSqlExtensionName) => PostgreSqlExtension;
  readonly domainsUsed: PostgreSqlDomain[];
  readonly useDomain: (
    name: PostgreSqlDomainName,
    onCreate: (
      name: PostgreSqlDomainName,
      schema: PostgreSqlSchema,
    ) => PostgreSqlDomain,
  ) => PostgreSqlDomain;
}

export function isPostgreSqlSchema(
  ag: SqlAffinityGroup,
): ag is PostgreSqlSchema {
  return "createSchemaSql" && "dropSchemaSql" in ag;
}

export interface DcpTemplateStateQualifiedReferencesObservation {
  readonly referencesObserved: string[]; // TODO: give this a proper type
}

export interface DcpTemplateState extends interp.InterpolationState {
  readonly ic: DcpInterpolationContext;
  readonly schema: PostgreSqlSchema;
  readonly isSchemaDefaulted: boolean;
  readonly affinityGroup: SqlAffinityGroup | PostgreSqlSchema;
  readonly searchPath: PostgreSqlSchema[];
  readonly indentation: interp.Indentable;
  readonly headers: DcpTemplateSupplier[];
  readonly extensions?: PostgreSqlExtension[];
  readonly setSearchPathSql: (
    prepend?: string | string[],
    append?: string | string[],
  ) => PostgreSqlStatement;
  readonly qualifiedReferencesObserved:
    DcpTemplateStateQualifiedReferencesObservation;
  readonly observableQR: (
    ...groups: SqlAffinityGroup[]
  ) => ObservableQualifiedReferenceSupplier[];
}

export const isDcpTemplateState = safety.typeGuard<DcpTemplateState>(
  "schema",
  "isSchemaDefaulted",
  "searchPath",
);

export interface InterpolationContextStateOptions {
  readonly schema?: PostgreSqlSchema;
  readonly affinityGroup?: SqlAffinityGroup;
  readonly searchPath?: PostgreSqlSchema[];
  readonly extensions?: PostgreSqlExtension[];
  readonly headers?: {
    readonly standalone?: DcpTemplateSupplier[];
    readonly embedded?: DcpTemplateSupplier[];
  };
}

export interface DcpInterpolationResult extends interp.InterpolationResult {
  readonly ctx: DcpInterpolationContext;
  readonly state: DcpTemplateState;
}

export interface DcpInterpolationEngine extends interp.InterpolationEngine {
  readonly prepareResult: (
    interpolated: interp.InterpolatedContent,
    state: interp.InterpolationState,
    options: interp.InterpolationOptions,
  ) => DcpInterpolationResult;
}

export type DcpInterpolationContextVersion = string;

export interface DcpInterpolationContext {
  readonly version: DcpInterpolationContextVersion;
  readonly engine: DcpInterpolationEngine;
  readonly prepareTsModuleExecution: (
    importMetaURL: string,
    defaultP?: Partial<Omit<interp.TemplateProvenance, "importMetaURL">>,
  ) => interp.InterpolationExecution;
  readonly prepareState: (
    ie: interp.InterpolationExecution,
    options?: InterpolationContextStateOptions,
  ) => DcpTemplateState;
  readonly embed: (
    ic: DcpInterpolationContext,
    state: DcpTemplateState,
    irFn: (eic: DcpEmbeddedInterpolationContext) => DcpInterpolationResult,
  ) => interp.InterpolatedContent;
}

export interface DcpEmbeddedInterpolationContext
  extends DcpInterpolationContext {
  readonly parent: interp.InterpolationState;
}

export const isEmbeddedInterpolationContext = safety.typeGuard<
  DcpEmbeddedInterpolationContext
>("parent");
