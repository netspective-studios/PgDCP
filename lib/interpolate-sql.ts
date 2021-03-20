import { fmt, path, safety, textWhitespace as tw } from "./deps.ts";
import * as interp from "./interpolate.ts";

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
  state: interp.InterpolationState,
  options: DcpInterpolationOptions = { prependHeaders: true },
): DcpTemplateLiteral {
  return (literals: TemplateStringsArray, ...expressions: unknown[]) => {
    let interpolated = "";
    if (isDcpTemplateState(state)) {
      if (state.headers.length > 0) {
        const { indent } = state.indentation;
        interpolated = state.headers.map((h) => {
          return indent(h(ctx, state));
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

export type TextValue = string;
export interface TextValueSupplier {
  (...args: string[]): string;
}

export type SqlStatement = string;
export type PostgreSqlStatement = SqlStatement;
export type PostgreSqlSchemaName = string;
export type PostgreSqlStoredRoutineName = string;
export type AffinityGroupName = PostgreSqlSchemaName;

export interface PostgreSqlStatementSupplier {
  (ctx: DcpInterpolationContext): PostgreSqlStatement;
}

export interface PostgreSqlStoredRoutineNameSupplier {
  (ctx: DcpInterpolationContext): PostgreSqlStoredRoutineName;
}

export interface PostgreSqlStoredRoutineNameDecorator {
  (
    ctx: DcpInterpolationContext,
    suggested: string,
  ): PostgreSqlStoredRoutineName;
}

export interface PostgreSqlSchemaAffinityGroup {
  readonly schema: PostgreSqlSchema;
  readonly name: AffinityGroupName;
  readonly qualifiedReference: (qualify: string) => string;
  readonly dependencies?: {
    readonly groups?: PostgreSqlSchemaAffinityGroup[];
    readonly schemas?: PostgreSqlSchema[];
  };
  readonly functionNames: {
    readonly construct: PostgreSqlStoredRoutineNameSupplier;
    readonly destroy: PostgreSqlStoredRoutineNameSupplier;
    readonly unitTest: PostgreSqlStoredRoutineNameSupplier;
    readonly populateSecrets: PostgreSqlStoredRoutineNameSupplier;
    readonly populateData: PostgreSqlStoredRoutineNameSupplier;
  };
}

export interface PostgreSqlSchemaAffinityGroups {
  readonly typical: (
    name: AffinityGroupName,
    dependencies?: {
      readonly groups?: PostgreSqlSchemaAffinityGroup[];
      readonly schemas?: PostgreSqlSchema[];
    },
    ...args: string[]
  ) => PostgreSqlSchemaAffinityGroup;
}

export interface PostgreSqlSchema {
  readonly name: PostgreSqlSchemaName;
  readonly dependencies?: PostgreSqlSchema[];
  readonly qualifiedReference: (qualify: string) => string;
  readonly createSchemaSql: PostgreSqlStatementSupplier;
  readonly dropSchemaSql: PostgreSqlStatementSupplier;
  readonly setSearchPathSql: PostgreSqlStatementSupplier;
  readonly affinityGroups: (
    ctx: DcpInterpolationContext,
  ) => PostgreSqlSchemaAffinityGroups;
  readonly functionNames: {
    readonly construct: PostgreSqlStoredRoutineNameSupplier;
    readonly destroy: PostgreSqlStoredRoutineNameSupplier;
    readonly unitTest: PostgreSqlStoredRoutineNameSupplier;
    readonly populateSecrets: PostgreSqlStoredRoutineNameSupplier;
    readonly populateData: PostgreSqlStoredRoutineNameSupplier;
  };
}

export interface PostgreSqlSchemaSupplier {
  (
    name: PostgreSqlSchemaName,
    dependencies?: PostgreSqlSchema[],
    ...args: string[]
  ): PostgreSqlSchema;
}

export interface DcpSqlSchemaSupplier {
  readonly lifecycle: PostgreSqlSchema;
  readonly assurance: PostgreSqlSchema;
  readonly experimental: PostgreSqlSchema;
  readonly lib: PostgreSqlSchema;
  readonly typical: PostgreSqlSchemaSupplier;
  readonly sensitive: {
    readonly compliance: (
      name: PostgreSqlSchemaName,
      dependencies?: PostgreSqlSchema[],
      ...regulations: string[]
    ) => PostgreSqlSchema;
  };
  readonly stateless: {
    readonly typical: PostgreSqlSchemaSupplier;
    readonly enhance: PostgreSqlSchemaSupplier;
  };
  readonly stateful: {
    readonly typical: PostgreSqlSchemaSupplier;
    readonly enhance: PostgreSqlSchemaSupplier;
  };
}

export interface DcpSqlFunctionNameSupplier {
  readonly construct: PostgreSqlStoredRoutineNameDecorator;
  readonly destroy: PostgreSqlStoredRoutineNameDecorator;
  readonly unitTest: PostgreSqlStoredRoutineNameDecorator;
  readonly populateSecrets: PostgreSqlStoredRoutineNameDecorator;
  readonly populateData: PostgreSqlStoredRoutineNameDecorator;
}

export interface DcpTemplateSupplier {
  (ctx: DcpInterpolationContext): string;
}

export interface DcpStateTemplateSupplier {
  (ctx: DcpInterpolationContext, state: DcpTemplateState): string;
}

export interface DcpStateTemplatesSupplier {
  readonly preface: DcpStateTemplateSupplier;
  readonly embeddedPreface: DcpStateTemplateSupplier;
  readonly schema: DcpStateTemplateSupplier;
  readonly searchPath: DcpStateTemplateSupplier;
}

export interface DataComputingPlatformSqlSupplier {
  readonly schemas: DcpSqlSchemaSupplier;
  readonly functionNames: DcpSqlFunctionNameSupplier;
  readonly templates: DcpStateTemplatesSupplier;
}

export interface DcpTemplateState extends interp.InterpolationState {
  readonly schema: PostgreSqlSchema;
  readonly isSchemaDefaulted: boolean;
  readonly affinityGroup: PostgreSqlSchemaAffinityGroup | PostgreSqlSchema;
  readonly searchPath: string[];
  readonly indentation: interp.Indentable;
  readonly headers: DcpStateTemplateSupplier[];
}

export const isDcpTemplateState = safety.typeGuard<DcpTemplateState>(
  "schema",
  "isSchemaDefaulted",
  "searchPath",
);

export interface InterpolationContextStateOptions {
  readonly schema?: PostgreSqlSchema;
  readonly affinityGroup?: AffinityGroupName | PostgreSqlSchemaAffinityGroup;
  readonly searchPath?: string[];
  readonly headers?: {
    readonly standalone?: DcpStateTemplateSupplier[];
    readonly embedded?: DcpStateTemplateSupplier[];
  };
}

export interface DcpInterpolationResult extends interp.InterpolationResult {
  readonly ctx: DcpInterpolationContext;
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
  readonly sql: DataComputingPlatformSqlSupplier;
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

export function typicalPostgreSqlSchemaAffinityGroups(
  schema: PostgreSqlSchema,
): PostgreSqlSchemaAffinityGroups {
  const groups: PostgreSqlSchemaAffinityGroups = {
    typical: (name, dependencies?) => {
      const group: PostgreSqlSchemaAffinityGroup = {
        schema,
        name,
        qualifiedReference: (qualify: string) => {
          return `${name}_${qualify}`;
        },
        dependencies,
        functionNames: {
          construct: (ctx) => {
            return ctx.sql.functionNames.construct(ctx, name);
          },
          destroy: (ctx) => {
            return ctx.sql.functionNames.destroy(ctx, name);
          },
          unitTest: (ctx) => {
            return ctx.sql.functionNames.unitTest(ctx, name);
          },
          populateSecrets: (ctx) => {
            return ctx.sql.functionNames.populateSecrets(ctx, name);
          },
          populateData: (ctx) => {
            return ctx.sql.functionNames.populateData(ctx, name);
          },
        },
      };
      return group;
    },
  };
  return groups;
}

export function typicalPostgreSqlSchema(
  name: PostgreSqlSchemaName,
  dependencies?: PostgreSqlSchema[],
): PostgreSqlSchema {
  const searchPath: string[] = [name];
  if (dependencies) {
    dependencies.forEach((s) => searchPath.push(s.name));
  }
  const result: PostgreSqlSchema = {
    name,
    dependencies,
    qualifiedReference: (qualify: string) => {
      return `${name}.${qualify}`;
    },
    createSchemaSql: () => {
      return `CREATE SCHEMA IF NOT EXISTS ${name}`;
    },
    dropSchemaSql: () => {
      return `DROP SCHEMA IF EXISTS ${name} CASCADE`;
    },
    setSearchPathSql: () => {
      return `SET search_path TO ${searchPath.join(", ")}`;
    },
    functionNames: {
      construct: (ctx) => {
        return ctx.sql.functionNames.construct(ctx, name);
      },
      destroy: (ctx) => {
        return ctx.sql.functionNames.destroy(ctx, name);
      },
      unitTest: (ctx) => {
        return ctx.sql.functionNames.unitTest(ctx, name);
      },
      populateSecrets: (ctx) => {
        return ctx.sql.functionNames.populateSecrets(ctx, name);
      },
      populateData: (ctx) => {
        return ctx.sql.functionNames.populateData(ctx, name);
      },
    },
    affinityGroups: () => {
      return typicalPostgreSqlSchemaAffinityGroups(result);
    },
  };
  return result;
}

export function typicalDcpSqlSupplier(): DataComputingPlatformSqlSupplier {
  const ic: DataComputingPlatformSqlSupplier = {
    schemas: {
      lifecycle: typicalPostgreSqlSchema("dcp_lifecycle"),
      assurance: typicalPostgreSqlSchema("dcp_assurance_engineering"),
      experimental: typicalPostgreSqlSchema("dcp_experimental"),
      lib: typicalPostgreSqlSchema("dcp_lib"),
      typical: (name, dependencies) => {
        return typicalPostgreSqlSchema(`dcp_${name}`, dependencies);
      },
      sensitive: {
        compliance: (name, dependencies?, ...regulations) => {
          return typicalPostgreSqlSchema(
            `dcp_sensitive_${regulations.join("_")}_${name}`,
            dependencies,
          );
        },
      },
      stateless: {
        typical: (name, dependencies) => {
          return typicalPostgreSqlSchema(`dcp_stateless_${name}`, dependencies);
        },
        enhance: (name, dependencies) => {
          return typicalPostgreSqlSchema(
            `dcp_stateless_enhance_${name}`,
            dependencies,
          );
        },
      },
      stateful: {
        typical: (name, dependencies) => {
          return typicalPostgreSqlSchema(`dcp_stateful_${name}`, dependencies);
        },
        enhance: (name, dependencies) => {
          return typicalPostgreSqlSchema(
            `dcp_stateful_${name}_enhance`,
            dependencies,
          );
        },
      },
    },
    functionNames: {
      construct: (ctx, suggested) => {
        return ic.schemas.lifecycle.qualifiedReference(
          `dcp_lc_${suggested}_construct`,
        );
      },
      destroy: (ctx, suggested) => {
        return ic.schemas.lifecycle.qualifiedReference(
          `dcp_lc_${suggested}_destroy`,
        );
      },
      unitTest: (ctx, suggested) => {
        return ic.schemas.assurance.qualifiedReference(`test_${suggested}`);
      },
      populateSecrets: (ctx, suggested) => {
        return ic.schemas.lifecycle.qualifiedReference(
          `dcp_lc_${suggested}_populateSecrets`,
        );
      },
      populateData: (ctx, suggested) => {
        return ic.schemas.lifecycle.qualifiedReference(
          `dcp_lc_${suggested}_populateData`,
        );
      },
    },
    templates: {
      preface: (ctx, state) => {
        const { provenance } = state.ie;
        return tw.unindentWhitespace(`
          -- Code generated by PgDCP ${ctx.engine.version}. DO NOT EDIT.
          -- source: ${provenance.identity} (${provenance.source})
          -- version: ${provenance.version}`);
      },
      embeddedPreface: (ctx, state) => {
        const { provenance } = state.ie;
        return tw.unindentWhitespace(`
          -- embedded from: ${provenance.identity} (${provenance.source})
          -- version: ${provenance.version}`);
      },
      schema: (ctx, state) => {
        return `${state.schema.createSchemaSql(ctx)};`;
      },
      searchPath: (ctx, state) => {
        return state.searchPath
          ? `SET search_path TO ${state.searchPath.join(", ")};`
          : `SET search_path TO ${ctx.sql.schemas.experimental}; -- ${ctx.sql.schemas.experimental} is used because no searchPath provided`;
      },
    },
  };
  return ic;
}

export function typicalDcpInterpolationContext(
  version: DcpInterpolationContextVersion,
  sql: DataComputingPlatformSqlSupplier,
): DcpInterpolationContext {
  const dcpIC: DcpInterpolationContext = {
    version,
    engine: {
      version: version,
      prepareInterpolation(
        provenance: interp.TemplateProvenance,
      ): interp.InterpolationExecution {
        return {
          provenance,
        };
      },
      prepareResult(
        interpolated: interp.InterpolatedContent,
        state: interp.InterpolationState,
        options: interp.InterpolationOptions,
      ): DcpInterpolationResult {
        return {
          ctx: dcpIC,
          state,
          interpolated,
          options,
        };
      },
    },
    sql,
    prepareTsModuleExecution: (
      importMetaURL: string,
      defaultP?: Partial<Omit<interp.TemplateProvenance, "importMetaURL">>,
    ): interp.InterpolationExecution => {
      const provenance: interp.TypeScriptModuleProvenance & interp.Indentable =
        {
          source: importMetaURL,
          importMetaURL,
          identity: defaultP?.identity || importMetaURL.split("/").pop() ||
            importMetaURL,
          version: defaultP?.version || "0.0.0",
          indent: (text) => {
            return text.replace(/^/gm, "    ");
          },
          unindent: (text) => {
            return tw.unindentWhitespace(text);
          },
        };
      return {
        provenance,
      };
    },
    prepareState: (
      ie: interp.InterpolationExecution,
      options: InterpolationContextStateOptions = {
        schema: sql.schemas.experimental,
      },
    ): DcpTemplateState => {
      const schema = options.schema || sql.schemas.experimental;
      const dcpTS: DcpTemplateState = {
        ie,
        schema,
        isSchemaDefaulted: options.schema ? false : true,
        affinityGroup: options.affinityGroup
          ? (typeof options.affinityGroup === "string"
            ? schema.affinityGroups(dcpIC).typical(options.affinityGroup)
            : options.affinityGroup)
          : schema,
        searchPath: options.searchPath ? options.searchPath : [schema.name],
        indentation: interp.isIndentable(ie.provenance)
          ? ie.provenance
          : interp.noIndentation,
        headers: typeof options.headers === "undefined"
          ? [
            sql.templates.preface,
            sql.templates.schema,
            sql.templates.searchPath,
          ]
          : (options.headers?.standalone || []),
      };
      return dcpTS;
    },
    embed: (
      ic: DcpInterpolationContext,
      parent: DcpTemplateState,
      irFn: (
        eic: DcpEmbeddedInterpolationContext,
      ) => DcpInterpolationResult,
    ): interp.InterpolatedContent => {
      const eic: DcpEmbeddedInterpolationContext = {
        ...ic,
        parent,
        prepareState: (
          ie: interp.InterpolationExecution,
          options: InterpolationContextStateOptions = {
            schema: sql.schemas.experimental,
          },
        ): DcpTemplateState => {
          // an embedded template is basically the same as its parent except
          // it might have different headers
          const base = ic.prepareState(ie, options);
          return {
            ...base,
            headers: options?.headers?.embedded || [
              sql.templates.embeddedPreface,
              sql.templates.schema,
              sql.templates.searchPath,
            ],
          };
        },
      };
      const eir = irFn(eic);
      if (!isDcpTemplateState(eir.state)) {
        throw Error(
          `embed(): eir.state is expected to be of type DcpTemplateState not ${typeof eir
            .state}`,
        );
      }
      // When embedding, we first add the indented headers expected then
      // unident the embedded interpolation result and finally indent it
      // at the parent's indentation level so that everything aligns
      const { state } = eir;
      return parent.indentation.indent(
        state.indentation.unindent(eir.interpolated),
      );
    },
  };
  return dcpIC;
}

export interface PostgreSqlInterpolationPersistOptions {
  readonly destHome?: string;
  readonly driverFileName?: string;
  readonly includeInDriver: (pir: PersistableSqlInterpolationResult) => boolean;
  readonly persist: (fileName: string, content: string) => Promise<void>;
}

export interface PersistableSqlInterpolationResult
  extends DcpInterpolationResult {
  readonly index: number;
  readonly original: interp.InterpolatedContent;
  readonly indexedFileName: string;
  readonly includeInDriver: boolean;
}

export class PostgreSqlInterpolationPersistence {
  readonly persistable: PersistableSqlInterpolationResult[] = [];

  constructor(
    readonly interpOptions: PostgreSqlInterpolationPersistOptions,
  ) {
  }

  registerPersistableResult(
    ir: DcpInterpolationResult,
    options: { index?: number; includeInDriver?: boolean } = {},
  ): PersistableSqlInterpolationResult {
    if (!isDcpTemplateState(ir.state)) {
      throw Error(
        `preparePersistable(ir): ir.state is expected to be of type DcpTemplateState not ${typeof ir
          .state}`,
      );
    }

    const { state } = ir;
    const lastIndex = this.persistable.length > 0
      ? this.persistable[this.persistable.length - 1].index
      : -1;
    const index = options.index ? options.index : lastIndex + 1;
    const indexedFileName = fmt.sprintf(
      path.join("%03d_%s.auto.sql"),
      index,
      state.ie.provenance.identity.replace(/\..+$/, ""),
    );
    const result: PersistableSqlInterpolationResult = {
      ...ir,
      index,
      interpolated: state.indentation.unindent(ir.interpolated),
      original: ir.interpolated,
      indexedFileName,
      includeInDriver: typeof options.includeInDriver === "boolean"
        ? options.includeInDriver
        : true,
    };
    this.persistable.push(result);
    return result;
  }

  async persistResult(result: PersistableSqlInterpolationResult) {
    if (this.interpOptions.destHome) {
      const fileName = path.join(
        this.interpOptions.destHome,
        result.indexedFileName,
      );
      await this.interpOptions.persist(fileName, result.interpolated);
    } else {
      console.log(result.interpolated);
    }
  }

  async persistResults(): Promise<void> {
    await Promise.all(this.persistable.map((p) => this.persistResult(p)));
    if (this.interpOptions.destHome && this.interpOptions.driverFileName) {
      const fileName = path.join(
        this.interpOptions.destHome,
        this.interpOptions.driverFileName,
      );
      const driver = this.persistable.filter((pir) => pir.includeInDriver)
        .map((pir) => {
          return tw.unindentWhitespace(`\\ir ${pir.indexedFileName}`);
        }).join("\n");
      await this.interpOptions.persist(fileName, driver);
    }
  }
}
