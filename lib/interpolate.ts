import { textWhitespace as tw } from "./deps.ts";

export interface TemplateProvenance {
  readonly identity: string;
  readonly version: string;
  readonly source: string;
}

export interface TypeScriptModuleProvenance extends TemplateProvenance {
  readonly importMetaURL: string;
}

export interface InterpolationExecution {
  readonly index: number;
  readonly stamp: Date;
}

export type InterpolatedContent = string;

export interface InterpolationEngine<C> {
  readonly version: string;
  readonly ctx: C;
  readonly prepareInterpolation: (
    p: TemplateProvenance,
  ) => InterpolationExecution;
  readonly registerResult: (
    interpolated: InterpolatedContent,
    state: InterpolationState,
    options: InterpolationOptions,
  ) => InterpolationResult<C>;
}

export interface InterpolationState {
  readonly provenance: TemplateProvenance;
  readonly execID: InterpolationExecution;
}

export interface InterpolationOptions {
  readonly unindent: boolean;
}

export interface InterpolationResult<C> {
  readonly engine: InterpolationEngine<C>;
  readonly state: InterpolationState;
  readonly options: InterpolationOptions;
  readonly interpolated: string;
}

export interface TemplateLiteral<C> {
  (
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): InterpolationResult<C>;
}

export interface TemplateSupplier<C> {
  (
    ctx: InterpolationEngine<C>,
    state: InterpolationState,
  ): TemplateLiteral<C>;
}

/**
 * Creates a template tag which can be "executed" in the given context with a 
 * local state. 
 * @param engine is the context that all templates can use across invocations
 * @param state is the "local" state of a single interpolation
 * @returns the interpolated template text
 */
export function executeTemplate<C>(
  engine: InterpolationEngine<C>,
  state: InterpolationState,
  options: InterpolationOptions,
): TemplateLiteral<C> {
  return (literals: TemplateStringsArray, ...expressions: unknown[]) => {
    let interpolated = "";
    for (let i = 0; i < expressions.length; i++) {
      interpolated += literals[i];
      interpolated += expressions[i];
    }
    interpolated += literals[literals.length - 1];
    if (options.unindent) {
      interpolated = tw.unindentWhitespace(interpolated);
    }
    return engine.registerResult(interpolated, state, options);
  };
}

/**
 * Creates a SQL template tag which can be "executed" in the given context 
 * with a local state. The special 'SQL' name is used by some Visual Studio
 * Code extensions to do code highlighting and error detection inside template
 * literal so it's worth creating a wrapper around executeTemplate which is
 * generic.
 * @param engine is the context that all templates can use across invocations
 * @param state is the "local" state of a single interpolation
 * @returns the interpolated template text
 */
export function SQL<C>(
  engine: InterpolationEngine<C>,
  state: InterpolationState,
  options: InterpolationOptions,
): TemplateLiteral<C> {
  return executeTemplate(engine, state, options);
}
