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
  readonly stateless: TextValueSupplier;
}

export interface DcpSqlDeploymentLifecycleFunctionCriterionSupplier {
  readonly prefix: TextValue;
  readonly construct: TextValueSupplier;
  readonly destroy: TextValueSupplier;
}

export interface DcpSqlFunctionNameSupplier {
  readonly prefix: TextValue;
  readonly stateless: TextValueSupplier;
  readonly administrative: TextValueSupplier;
  readonly destructive: TextValueSupplier;
  readonly deploy: DcpSqlDeploymentLifecycleFunctionCriterionSupplier;
}

export interface DataComputingPlatformSqlSupplier {
  readonly schemaName: DcpSqlSchemaNameSupplier;
  readonly functionName: DcpSqlFunctionNameSupplier;
}

export interface InterpolationContext {
  readonly engine: interp.InterpolationEngine;
  readonly sql: DataComputingPlatformSqlSupplier;
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
      lifecycle: "dcp_lifecyle",
      assurance: "dcp_assurance_engineering",
      experimental: "dcp_experimental",
      stateless: (name: string) => {
        return `${ic.schemaName.prefix}${name}`;
      },
    },
    functionName: {
      prefix: "dcp_",
      stateless: (name: string) => {
        return `${ic.functionName.prefix}${name}`;
      },
      administrative: (name: string) => {
        return `${ic.schemaName.lifecycle}.${ic.functionName.prefix}${name}`;
      },
      destructive: (name: string) => {
        return `${ic.schemaName.lifecycle}.${ic.functionName.prefix}${name}`;
      },
      deploy: {
        prefix: "dcp_lc_deploy_",
        construct: (name: string) => {
          return `${ic.schemaName.lifecycle}.${ic.functionName.deploy.prefix}construct_${name}`;
        },
        destroy: (name: string) => {
          return `${ic.schemaName.lifecycle}.${ic.functionName.deploy.prefix}destroy_${name}`;
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
  engine: interp.InterpolationEngine,
  provenance: interp.TypeScriptModuleProvenance,
): Promise<interp.InterpolationState> {
  const result: interp.InterpolationState = {
    provenance: provenance,
    execID: engine.prepareInterpolation(provenance),
  };
  return result;
}

export async function typicalSchemaState(
  engine: interp.InterpolationEngine,
  provenance: interp.TypeScriptModuleProvenance,
  schema: string,
): Promise<
  & interp.InterpolationState
  & InterpolationSchemaSupplier
  & InterpolationSchemaSearchPathSupplier
> {
  return {
    ...await typicalState(engine, provenance),
    schema,
    searchPath: [schema],
  };
}

export async function typicalSchemaSearchPathState<
  C extends DataComputingPlatformSqlSupplier,
>(
  engine: interp.InterpolationEngine,
  provenance: interp.TypeScriptModuleProvenance,
  schema: string,
  searchPath: string[],
): Promise<
  & interp.InterpolationState
  & InterpolationSchemaSupplier
  & InterpolationSchemaSearchPathSupplier
> {
  return {
    ...await typicalSchemaState(engine, provenance, schema),
    searchPath: [schema, ...searchPath],
  };
}
