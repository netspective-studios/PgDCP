import { textWhitespace as tw } from "./deps.ts";

export interface TemplateProvenance {
  readonly identity: string;
  readonly importMetaURL: string;
  readonly version: string;
}

export interface InterpolationEngine<C, P extends TemplateProvenance> {
  readonly version: string;
  readonly ctx: C;
  readonly prepareExecution: (
    p: TemplateProvenance,
  ) => InterpolationExecutionIdentity;
  readonly onSuccessfulInterpolation?: (
    result: InterpolationResult<C, TemplateProvenance>,
  ) => void;
  readonly transformResult?: InterpolationResultTransformer<C, P>;
  readonly transformContent?: (
    result: InterpolationResult<C, TemplateProvenance>,
  ) => string;
}

export interface InterpolationExecutionIdentity {
  readonly index: number;
  readonly stamp: Date;
}

export interface InterpolationState<P extends TemplateProvenance> {
  readonly provenance: P;
  readonly execID: InterpolationExecutionIdentity;
}

export interface InterpolationResultTransformer<
  C,
  P extends TemplateProvenance,
> {
  (result: InterpolationResult<C, P>): InterpolationResult<C, P>;
}

export interface InterpolationOptions {
  readonly unindent: boolean;
}

export interface InterpolationResult<C, P extends TemplateProvenance> {
  readonly engine: InterpolationEngine<C, P>;
  readonly state: InterpolationState<P>;
  readonly options: InterpolationOptions;
  readonly interpolated: string;
}

export interface TemplateLiteral<C, P extends TemplateProvenance> {
  (
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): InterpolationResult<C, P>;
}

export interface TemplateSupplier<T, P extends TemplateProvenance> {
  (
    ctx: InterpolationEngine<T, P>,
    state: InterpolationState<P>,
  ): TemplateLiteral<T, P>;
}

/**
 * Creates a template tag which can be "executed" in the given context with a 
 * local state. 
 * @param engine is the context that all templates can use across invocations
 * @param state is the "local" state of a single interpolation
 * @returns the interpolated template text
 */
export function executeTemplate<C, P extends TemplateProvenance, LS>(
  engine: InterpolationEngine<C, P>,
  state: InterpolationState<P>,
  options: InterpolationOptions,
): TemplateLiteral<C, P> {
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
    const computed: InterpolationResult<C, P> = {
      engine,
      state,
      interpolated,
      options,
    };
    const result = engine.transformResult
      ? engine.transformResult(computed)
      : computed;
    if (engine.onSuccessfulInterpolation) {
      engine.onSuccessfulInterpolation(result);
    }
    return result;
  };
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
export function SQL<C, P extends TemplateProvenance>(
  ctx: InterpolationEngine<C, P>,
  state: InterpolationState<P>,
  options: InterpolationOptions,
): TemplateLiteral<C, P> {
  return executeTemplate(ctx, state, options);
}
