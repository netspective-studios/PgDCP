import { colors, fmt, path, safety, textWhitespace as tw } from "./deps.ts";
import * as interp from "./interpolate.ts";

export type TextValue = string;
export interface TextValueSupplier {
  (...args: string[]): string;
}

export interface DcpSqlSchemaNameSupplier {
  readonly prefix: TextValue;
  readonly lifecycle: TextValue;
  readonly assurance: TextValue;
  readonly experimental: TextValue;
  readonly lib: TextValue;
  readonly typical: TextValueSupplier;
  readonly stateless: TextValueSupplier;
}

export interface DcpSqlDeploymentLifecycleFunctionCriterionSupplier {
  readonly prefix: TextValue;
  readonly construct: TextValueSupplier;
  readonly destroy: TextValueSupplier;
}

export interface DcpSqlFunctionNameSupplier {
  readonly prefix: TextValue;
  readonly administrative: TextValueSupplier;
  readonly lifecycle: DcpSqlDeploymentLifecycleFunctionCriterionSupplier;
}

export interface DataComputingPlatformSqlSupplier {
  readonly schemaName: DcpSqlSchemaNameSupplier;
  readonly functionName: DcpSqlFunctionNameSupplier;
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
  readonly schema: string;
  readonly isSchemaDefaulted: boolean;
  readonly searchPath: string[];
  readonly decorations?: DcpSqlDecorationOptions;
}

export const isDcpTemplateState = safety.typeGuard<DcpTemplateState>(
  "schema",
  "isSchemaDefaulted",
  "searchPath",
);

export interface InterpolationContextStateOptions {
  readonly schema?: string;
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

export function typicalDcpSqlSupplier(): DataComputingPlatformSqlSupplier {
  const ic: DataComputingPlatformSqlSupplier = {
    schemaName: {
      prefix: "dcp_",
      lifecycle: "dcp_lifecycle",
      assurance: "dcp_assurance_engineering",
      experimental: "dcp_experimental",
      lib: "dcp_lib",
      typical: (name: string) => {
        return `${ic.schemaName.prefix}${name}`;
      },
      stateless: (name: string) => {
        return `${ic.schemaName.prefix}stateless_${name}`;
      },
    },
    functionName: {
      prefix: "dcp_",
      administrative: (name: string) => {
        return `${ic.schemaName.lifecycle}.${ic.functionName.prefix}admin_${name}`;
      },
      lifecycle: {
        prefix: "dcp_lc_",
        construct: (name: string) => {
          return `${ic.schemaName.lifecycle}.${ic.functionName.lifecycle.prefix}${name}_construct`;
        },
        destroy: (name: string) => {
          return `${ic.schemaName.lifecycle}.${ic.functionName.lifecycle.prefix}${name}_destroy`;
        },
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
        schema: sql.schemaName.experimental,
        decorations: defaultDecorations,
      },
    ): DcpTemplateState => {
      const schema = options.schema || sql.schemaName.experimental;
      const isSchemaDefaulted = options.schema ? false : true;
      const searchPath = options.searchPath ? options.searchPath : [schema];
      if (isEmbeddedInterpolationContext(result)) {
        const eis: interp.EmbeddedInterpolationState & DcpTemplateState = {
          ie,
          parent: result.parent,
          schema,
          isSchemaDefaulted,
          searchPath,
          decorations: options.decorations || defaultDecorations,
        };
        return eis;
      } else {
        return {
          ie,
          schema,
          isSchemaDefaulted,
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
          : `SET search_path TO ${this.dcpSS.schemaName.experimental}; -- ${this.dcpSS.schemaName.experimental} is used because no searchPath provided`,
      ) +
        "\n" + decorated;
    }
    if (state.decorations?.schemaDecoration) {
      decorated = indent(
        `CREATE SCHEMA IF NOT EXISTS ${state.schema}; ${
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
