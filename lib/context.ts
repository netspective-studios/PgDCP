import { safety } from "./deps.ts";
import * as interp from "./interpolate.ts";

export type TextValue = string;
export interface TextValueSupplier {
  (...args: string[]): string;
}

export interface SchemaNameSupplier {
  readonly prefix: TextValue;
  readonly lifecycle: TextValue;
  readonly assurance: TextValue;
  readonly experimental: TextValue;
  readonly stateless: TextValueSupplier;
}

export interface DeploymentLifecycleFunctionCriterionSupplier {
  readonly prefix: TextValue;
  readonly construct: TextValueSupplier;
  readonly destroy: TextValueSupplier;
}

export interface FunctionNameSupplier {
  readonly prefix: TextValue;
  readonly stateless: TextValueSupplier;
  readonly administrative: TextValueSupplier;
  readonly destructive: TextValueSupplier;
  readonly deploy: DeploymentLifecycleFunctionCriterionSupplier;
}

export interface InterpolationContext {
  readonly schemaName: SchemaNameSupplier;
  readonly functionName: FunctionNameSupplier;
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

export function typicalInterpolationContext(): InterpolationContext {
  const ic: InterpolationContext = {
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
export async function typicalState<C extends InterpolationContext>(
  engine: interp.InterpolationEngine<C>,
  provenance: interp.TypeScriptModuleProvenance,
): Promise<interp.InterpolationState> {
  const result: interp.InterpolationState = {
    provenance: provenance,
    execID: engine.prepareInterpolation(provenance),
  };
  return result;
}

export async function typicalSchemaState<C extends InterpolationContext>(
  engine: interp.InterpolationEngine<C>,
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
  C extends InterpolationContext,
>(
  engine: interp.InterpolationEngine<C>,
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
