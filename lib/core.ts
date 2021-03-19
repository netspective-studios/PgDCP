import { fmt, path, safety, textWhitespace as tw } from "./deps.ts";
import * as interp from "./interpolate.ts";

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

export interface DataComputingPlatformSqlSupplier {
  readonly schemas: DcpSqlSchemaSupplier;
  readonly functionNames: DcpSqlFunctionNameSupplier;
}

export interface DcpSqlDecorationOptions {
  readonly frontmatterDecoration: boolean;
  readonly schemaDecoration: boolean;
  readonly searchPathDecoration: boolean;
}

export const noDcpSqlDecorationOptions: DcpSqlDecorationOptions = {
  schemaDecoration: false,
  searchPathDecoration: false,
  frontmatterDecoration: false,
};

export interface DcpTemplateState extends interp.InterpolationState {
  readonly schema: PostgreSqlSchema;
  readonly isSchemaDefaulted: boolean;
  readonly affinityGroup: PostgreSqlSchemaAffinityGroup | PostgreSqlSchema;
  readonly searchPath: string[];
  readonly decorations?: DcpSqlDecorationOptions;
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
  readonly decorations?: DcpSqlDecorationOptions;
}

export interface DcpInterpolationContext {
  readonly engine: interp.InterpolationEngine;
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
    irFn: (eic: DcpEmbeddedInterpolationContext) => interp.InterpolationResult,
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
  };
  return ic;
}

export function typicalDcpInterpolationContext(
  engine: interp.InterpolationEngine,
  sql: DataComputingPlatformSqlSupplier,
  defaultDecorations: DcpSqlDecorationOptions = {
    schemaDecoration: true,
    searchPathDecoration: true,
    frontmatterDecoration: true,
  },
): DcpInterpolationContext {
  const result: DcpInterpolationContext = {
    engine,
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
        decorations: defaultDecorations,
      },
    ): DcpTemplateState => {
      const schema = options.schema || sql.schemas.experimental;
      const isSchemaDefaulted = options.schema ? false : true;
      const affinityGroup = options.affinityGroup
        ? (typeof options.affinityGroup === "string"
          ? schema.affinityGroups(result).typical(options.affinityGroup)
          : options.affinityGroup)
        : schema;
      const searchPath = options.searchPath
        ? options.searchPath
        : [schema.name];
      if (isEmbeddedInterpolationContext(result)) {
        const eis: interp.EmbeddedInterpolationState & DcpTemplateState = {
          ie,
          parent: result.parent,
          schema,
          isSchemaDefaulted,
          affinityGroup,
          searchPath,
          decorations: options.decorations || defaultDecorations,
        };
        return eis;
      } else {
        return {
          ie,
          schema,
          isSchemaDefaulted,
          affinityGroup,
          searchPath,
          decorations: options.decorations || defaultDecorations,
        };
      }
    },
    embed: (
      ic: DcpInterpolationContext,
      state: DcpTemplateState,
      irFn: (
        eic: DcpEmbeddedInterpolationContext,
      ) => interp.InterpolationResult,
    ): interp.InterpolatedContent => {
      const eic: DcpEmbeddedInterpolationContext = {
        ...ic,
        parent: state,
      };
      const eir = irFn(eic);
      const { provenance } = eir.state.ie;
      return `    -- Embedded from: ${provenance.identity} (${provenance.source})\n${eir.interpolated}`;
    },
  };
  return result;
}

export interface PostgreSqlInterpolationEngineOptions {
  readonly destHome?: string;
  readonly driverFileName?: string;
  readonly includeInDriver: (pir: PersistableSqlInterpolationResult) => boolean;
  readonly persist: (fileName: string, content: string) => Promise<void>;
}

export interface PersistableSqlInterpolationResult
  extends interp.InterpolationResult {
  readonly index: number;
  readonly original: interp.InterpolatedContent;
  readonly indexedFileName: string;
  readonly includeInDriver: boolean;
}

export class PostgreSqlInterpolationEngine
  implements interp.InterpolationEngine {
  readonly persistable: PersistableSqlInterpolationResult[] = [];

  constructor(
    readonly version: string,
    readonly interpOptions: PostgreSqlInterpolationEngineOptions,
    readonly dcpSS: DataComputingPlatformSqlSupplier,
  ) {
  }

  prepareInterpolation(
    provenance: interp.TemplateProvenance,
  ): interp.InterpolationExecution {
    return {
      provenance,
    };
  }

  indentation(state: interp.InterpolationState): interp.Indentable {
    if (!interp.isEmbeddedInterpolationState(state)) {
      for (const test of [state.ie.provenance, state]) {
        if (interp.isIndentable(test)) {
          return test;
        }
      }
    }
    return interp.noIndentation;
  }

  prepareResult(
    interpolated: interp.InterpolatedContent,
    state: interp.InterpolationState,
    options: interp.InterpolationOptions,
  ): interp.InterpolationResult {
    if (!isDcpTemplateState(state)) {
      throw Error(
        `prepareResult(interpolated, state, options): state is expected to be of type DcpTemplateState not ${typeof state}`,
      );
    }
    let decorated = interpolated;
    const { indent } = this.indentation(state);
    if (state.decorations?.searchPathDecoration) {
      decorated = indent(
        state.searchPath
          ? `SET search_path TO ${[state.searchPath].join(", ")};`
          : `SET search_path TO ${this.dcpSS.schemas.experimental}; -- ${this.dcpSS.schemas.experimental} is used because no searchPath provided`,
      ) +
        "\n" + decorated;
    }
    if (state.decorations?.schemaDecoration) {
      decorated = indent(
        `CREATE SCHEMA IF NOT EXISTS ${state.schema.name}; ${
          state.isSchemaDefaulted
            ? "-- no InterpolationSchemaSupplier.schema supplied"
            : ""
        }`,
      ) + "\n" + decorated;
    }
    return {
      engine: this,
      state,
      options,
      interpolated: decorated,
    };
  }

  registerPersistableResult(
    ir: interp.InterpolationResult,
    options: { index?: number; includeInDriver?: boolean } = {},
  ): PersistableSqlInterpolationResult {
    if (!isDcpTemplateState(ir.state)) {
      throw Error(
        `preparePersistable(ir): ir.state is expected to be of type DcpTemplateState not ${typeof ir
          .state}`,
      );
    }

    const lastIndex = this.persistable.length > 0
      ? this.persistable[this.persistable.length - 1].index
      : -1;
    const index = options.index ? options.index : lastIndex + 1;
    const { state } = ir;
    const { provenance } = state.ie;
    const { indent, unindent } = this.indentation(state);
    const indexedFileName = fmt.sprintf(
      path.join("%03d_%s.auto.sql"),
      index,
      state.ie.provenance.identity.replace(/\..+$/, ""),
    );
    const result: PersistableSqlInterpolationResult = {
      ...ir,

      index,
      interpolated: unindent(
        state.decorations?.frontmatterDecoration
          ? indent(tw.unindentWhitespace(`
      -- Code generated by PgDCP ${this.version}. DO NOT EDIT.
      -- source: ${provenance.identity} (${provenance.source})
      -- version: ${provenance.version}`)) + "\n" + ir.interpolated
          : ir.interpolated,
      ),
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
