import { safety } from "./deps.ts";

export interface TemplateProvenanceHumanReadableSourceSupplier {
  (p: TemplateProvenance): string;
}

export interface TemplateProvenance {
  readonly identity: string;
  readonly version: string;
  readonly source: string;
  readonly humanReadableSource: TemplateProvenanceHumanReadableSourceSupplier;
}

export interface TextTransformer {
  (text: string): string;
}

export const noTextTransformation: TextTransformer = (text) => {
  return text;
};

export interface Indentable {
  readonly indent: TextTransformer;
  readonly unindent: TextTransformer;
}

export const noIndentation: Indentable = {
  indent: noTextTransformation,
  unindent: noTextTransformation,
};

export const isIndentable = safety.typeGuard<Indentable>(
  "indent",
  "unindent",
);

export interface TypeScriptModuleProvenance extends TemplateProvenance {
  readonly importMetaURL: string;
}

export const isTypeScriptModuleProvenance = safety.typeGuard<
  TypeScriptModuleProvenance
>("importMetaURL");

export interface InterpolationExecution {
  readonly provenance: TemplateProvenance;
}

export type InterpolatedContent = string;

export interface InterpolationEngine {
  readonly version: string;
  readonly prepareInterpolation: (
    p: TemplateProvenance,
  ) => InterpolationExecution;
  readonly prepareResult: (
    interpolated: InterpolatedContent,
    state: InterpolationState,
    options: InterpolationOptions,
  ) => InterpolationResult;
}

export interface InterpolationState {
  readonly ie: InterpolationExecution;
}

export interface EmbeddedInterpolationState extends InterpolationState {
  readonly parent: InterpolationState;
}

export const isEmbeddedInterpolationState = safety.typeGuard<
  EmbeddedInterpolationState
>("ie", "parent");

// deno-lint-ignore no-empty-interface
export interface InterpolationOptions {
}

export interface InterpolationResult {
  readonly state: InterpolationState;
  readonly options: InterpolationOptions;
  readonly interpolated: string;
}

export interface TemplateLiteral {
  (
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): InterpolationResult;
}

/**
 * Creates a template tag which can be "executed" in the given context with a 
 * local state. 
 * @param engine is the context that all templates can use across invocations
 * @param state is the "local" state of a single interpolation
 * @returns the interpolated template text
 */
export function executeTemplate(
  engine: InterpolationEngine,
  state: InterpolationState,
  options: InterpolationOptions = {},
): TemplateLiteral {
  return (literals: TemplateStringsArray, ...expressions: unknown[]) => {
    let interpolated = "";
    for (let i = 0; i < expressions.length; i++) {
      interpolated += literals[i];
      interpolated += expressions[i];
    }
    interpolated += literals[literals.length - 1];
    return engine.prepareResult(interpolated, state, options);
  };
}
