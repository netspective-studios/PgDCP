import { safety, textWhitespace as tw } from "./deps.ts";
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
