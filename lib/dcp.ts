import { safety } from "./deps.ts";
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

export interface InterpolationContext {
  readonly engine: interp.InterpolationEngine;
  readonly sql: DataComputingPlatformSqlSupplier;
}

export interface EmbeddedInterpolationContext extends InterpolationContext {
  readonly parent: interp.InterpolationState;
}

export const isEmbeddedInterpolationContext = safety.typeGuard<
  EmbeddedInterpolationContext
>("parent");

export function embeddedContext(
  ctx: InterpolationContext,
  parent: interp.InterpolationState,
): EmbeddedInterpolationContext {
  return { ...ctx, parent };
}

export interface InterpolationSchemaSupplier {
  readonly schema: string;
}

export interface InterpolationSchemaSearchPathSupplier {
  readonly searchPath: string[];
}

export const isInterpolationSchemaSupplier = safety.typeGuard<
  InterpolationSchemaSupplier
>("schema");

export const isInterpolationSchemaSearchPathSupplier = safety.typeGuard<
  InterpolationSchemaSearchPathSupplier
>("searchPath");

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

// deno-lint-ignore require-await
export async function tsModuleProvenance(
  importMetaURL: string,
  defaultP: Partial<Omit<interp.TemplateProvenance, "importMetaURL">> = {},
): Promise<interp.TypeScriptModuleProvenance> {
  return {
    source: importMetaURL,
    importMetaURL,
    identity: defaultP.identity || importMetaURL.split("/").pop() ||
      importMetaURL,
    version: defaultP.version || "0.0.0",
  };
}

// deno-lint-ignore require-await
export async function typicalState(
  ctx: InterpolationContext,
  provenance: interp.TemplateProvenance,
): Promise<interp.InterpolationState> {
  if (isEmbeddedInterpolationContext(ctx)) {
    const result: interp.EmbeddedInterpolationState = {
      provenance: provenance,
      execID: ctx.parent.execID,
      parent: ctx.parent,
    };
    return result;
  } else {
    const result: interp.InterpolationState = {
      provenance: provenance,
      execID: ctx.engine.prepareInterpolation(provenance),
    };
    return result;
  }
}

export async function typicalSchemaState(
  ctx: InterpolationContext,
  provenance: interp.TemplateProvenance,
  schema: string,
): Promise<
  & interp.InterpolationState
  & InterpolationSchemaSupplier
  & InterpolationSchemaSearchPathSupplier
> {
  return {
    ...await typicalState(ctx, provenance),
    schema,
    searchPath: [schema],
  };
}

export async function typicalSchemaSearchPathState(
  ctx: InterpolationContext,
  provenance: interp.TemplateProvenance,
  schema: string,
  searchPath: string[],
): Promise<
  & interp.InterpolationState
  & InterpolationSchemaSupplier
  & InterpolationSchemaSearchPathSupplier
> {
  return {
    ...await typicalSchemaState(ctx, provenance, schema),
    searchPath: [schema, ...searchPath],
  };
}
