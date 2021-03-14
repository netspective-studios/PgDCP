#!/usr/bin/env -S deno run --unstable -A
import * as gsv from "https://denopkg.com/gov-suite/governed-service-helpers@v0.3.15/version.ts";
import * as docopt from "https://denopkg.com/Eyal-Shalev/docopt.js@v1.0.6/src/docopt.ts";
import * as fs from "https://deno.land/std@0.87.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.87.0/path/mod.ts";
import * as uuid from "https://deno.land/std@0.87.0/uuid/mod.ts";
import * as dotenv from "https://deno.land/x/dotenv/mod.ts";
import * as colors from "https://deno.land/std@0.87.0/fmt/colors.ts";

export function determineVersion(importMetaURL: string): Promise<string> {
  return gsv.determineVersionFromRepoTag(
    importMetaURL,
    { repoIdentity: "PgDCP" },
  );
}

export interface CommandHandlerCaller {
  readonly calledFromMetaURL: string;
  readonly calledFromMain: boolean;
  readonly version: string;
  readonly projectHome?: string;
}

export function defaultDocoptSpec(caller: CommandHandlerCaller): string {
  const stdArgs = ``;
  return `
PgDCP Controller ${caller.version}.

Usage:
dcpctl interpolate <tmpl-src-file>... [--single] [--dest=<dest-home>] [--log=<log-file>] ${stdArgs}
dcpctl doctor${stdArgs}
dcpctl version
dcpctl -h | --help

Options:
<dest-home>         Path where destination file(s) should be stored (STDOUT otherwise)
<tmpl-src-file>     A text file that will be eval'd as a JavaScript template literal string
<log-file>          Where to store processing log
--single             If supplied, then all tmpl-src-files' output is merged into a single output dest file
--dry-run           Show what will be done (but don't actually do it) [default: false]
--verbose           Be explicit about what's going on [default: false]
-h --help           Show this screen
  `;
}

export interface ControllerCommandHandler<C extends Controller> {
  (ctx: C): Promise<true | void>;
}

export interface CliArgsSupplier {
  readonly cliArgs: docopt.DocOptions;
}

export interface ControllerOptions<C extends Controller> {
  readonly projectHome: string;
  readonly transactionID: string;
  readonly isVerbose: boolean;
  readonly isDryRun: boolean;
  readonly buildHostID: string;

  readonly init?: () => Promise<void>;
  readonly interpolate: Interpolator<C>;
  readonly finalize?: () => Promise<void>;
  readonly doctor?: () => Promise<void>;
}

export type TemplateProvenance = string | Request | URL;

export interface Template {
  readonly provenance: TemplateProvenance;
  readonly content: () => Promise<string>;
}

export interface TemplateSupplier {
  (
    src: TemplateProvenance,
    defaultTmpl: Template,
    issueReporter?: (message: string) => void,
  ): Promise<Template>;
}

export function flexibleTemplateSupplier(): TemplateSupplier {
  return async (src, defaultTmpl, issueReporter): Promise<Template> => {
    switch (src) {
      case "-":
        return {
          provenance: src,
          content: async (): Promise<string> => {
            return new TextDecoder().decode(await Deno.readAll(Deno.stdin));
          },
        };

      default:
        if (typeof src === "string" && fs.existsSync(src)) {
          return {
            provenance: src,
            content: async () => {
              return await Deno.readTextFile(src);
            },
          };
        } else {
          const response = await fetch(src);
          if (response.status == 200) {
            return {
              provenance: src,
              content: async () => {
                return await response.text();
              },
            };
          } else {
            if (issueReporter) {
              issueReporter(
                `Unable to fetch ${src}: ${response.status} (${response.statusText})`,
              );
            }
            return defaultTmpl;
          }
        }
    }
  };
}

export type TextValue = string;
export interface TextValueSupplier {
  (...args: string[]): string;
}

export interface SchemaNameSupplier {
  prefix: TextValue;
  lifecycle: TextValue;
  assurance: TextValue;
  experimental: TextValue;
  stateless: TextValueSupplier;
}

export interface DeploymentLifecycleFunctionCriterionSupplier {
  prefix: TextValue;
  construct: TextValueSupplier;
  destroy: TextValueSupplier;
}

export interface FunctionNameSupplier {
  prefix: TextValue;
  stateless: TextValueSupplier;
  administrative: TextValueSupplier;
  destructive: TextValueSupplier;
  deploy: DeploymentLifecycleFunctionCriterionSupplier;
}

export type InterpolationGlobalState = Record<string, unknown>;
export type InterpolationLocalState = Record<string, unknown>;

export interface InterpolationHistory<C extends Controller> {
  readonly ctx: SingleTemplateInterpolationContext<C>;
  readonly local: InterpolationLocalState;
}

export interface MultiTemplateInterpolationState<C extends Controller> {
  readonly controller: C;
  readonly global: InterpolationGlobalState;
  readonly history: InterpolationHistory<C>[];
}

export type InterpolationOutputDestHomePath = string;
export type InterpolationOutputFileName = string;

export interface SingleTemplateInterpolationContext<C extends Controller> {
  readonly state: MultiTemplateInterpolationState<C>;
  readonly template: Template;
  readonly schema: SchemaNameSupplier;
  readonly fn: FunctionNameSupplier;
}

export interface InterpolationContextSupplier<C extends Controller> {
  (
    state: MultiTemplateInterpolationState<C>,
    template: Template,
  ): SingleTemplateInterpolationContext<C>;
}

export function typicalInterpolationContext<C extends Controller>(
  state: MultiTemplateInterpolationState<C>,
  template: Template,
): SingleTemplateInterpolationContext<C> {
  const ic: SingleTemplateInterpolationContext<C> = {
    state,
    template,
    schema: {
      prefix: "dcp_",
      lifecycle: "dcp_lifecyle",
      assurance: "dcp_assurance_engineering",
      experimental: "dcp_experimental",
      stateless: (name: string) => {
        return `${ic.schema.prefix}${name}`;
      },
    },
    fn: {
      prefix: "dcp_",
      stateless: (name: string) => {
        return `${ic.fn.prefix}${name}`;
      },
      administrative: (name: string) => {
        return `${ic.schema.lifecycle}.${ic.fn.prefix}${name}`;
      },
      destructive: (name: string) => {
        return `${ic.schema.lifecycle}.${ic.fn.prefix}${name}`;
      },
      deploy: {
        prefix: "dcp_lc_deploy_",
        construct: (name: string) => {
          return `${ic.schema.lifecycle}.${ic.fn.deploy.prefix}construct_${name}`;
        },
        destroy: (name: string) => {
          return `${ic.schema.lifecycle}.${ic.fn.deploy.prefix}destroy_${name}`;
        },
      },
    },
  };
  return ic;
}

export interface SingleTemplateInterpolationResult<C extends Controller> {
  readonly ctx: SingleTemplateInterpolationContext<C>;
  readonly content: string;
  readonly local: InterpolationLocalState;
}

export interface Interpolator<C extends Controller> {
  (
    state: MultiTemplateInterpolationState<C>,
    template: TemplateProvenance,
  ): Promise<SingleTemplateInterpolationResult<C>>;
}

export function typicalInterpolator<C extends Controller>(
  acquireTemplate: TemplateSupplier,
  interpolationContext: InterpolationContextSupplier<C>,
): Interpolator<C> {
  return async (
    state: MultiTemplateInterpolationState<C>,
    src: TemplateProvenance,
  ): Promise<SingleTemplateInterpolationResult<C>> => {
    const template = await acquireTemplate(src, {
      provenance: src,
      // deno-lint-ignore require-await
      content: async (): Promise<string> => {
        return `Unable to acquire ${src}`;
      },
    });
    // ctx/local/define are unused here but they're the "anchor" for template
    // content eval; templates are treated as strings with ${ctx.*} and
    // ${local.*} available
    const ctx = interpolationContext(state, template);
    let local: InterpolationLocalState = {};
    const define = (set: InterpolationLocalState): string => {
      local = set;
      // always return empty string since this will be called in templates
      // like ${define({x : y})} and acts as template-local variables manager
      return "";
    };
    const content = eval("`" + await template.content() + "`");
    return { content, ctx, local };
  };
}

export function controllerOptions<C extends Controller>(
  caller: CommandHandlerCaller,
  cliArgs: docopt.DocOptions,
  interpolate: Interpolator<C>,
): ControllerOptions<C> {
  const {
    "--project": projectArg,
    "--verbose": verboseArg,
    "--dry-run": dryRunArg,
    "--tx-id": transactionIdArg,
  } = cliArgs;
  const projectHomeDefault = projectArg
    ? projectArg as string
    : (caller.projectHome || Deno.cwd());
  const projectHomeRel = path.isAbsolute(projectHomeDefault)
    ? path.relative(Deno.cwd(), projectHomeDefault)
    : projectHomeDefault;
  const projectHomeAbs = path.resolve(Deno.cwd(), projectHomeRel);
  const isDryRun = dryRunArg ? true : false;
  const isVerbose = isDryRun || (verboseArg ? true : false);
  const transactionID = transactionIdArg
    ? transactionIdArg.toString()
    : uuid.v4.generate();

  const result: ControllerOptions<C> = {
    projectHome: projectHomeAbs,
    transactionID,
    isDryRun,
    isVerbose,
    buildHostID: Deno.hostname(),

    // deno-lint-ignore require-await
    init: async () => {
      [].forEach((path) => {
        if (!fs.existsSync(path)) {
          Deno.mkdirSync(path);
        }
      });
    },
    interpolate,
    // deno-lint-ignore require-await
    doctor: async () => {
      [
        ["Project Home", projectHomeAbs],
      ].forEach((home) => {
        const [name, dir] = home;
        console.log(
          `${name}: ${colors.yellow(path.relative(projectHomeAbs, dir))} (${
            fs.existsSync(dir)
              ? colors.green("exists")
              : colors.red("missing, will be created")
          })`,
        );
      });
    },
  };
  return result;
}

export class Controller {
  constructor(
    readonly cli: CliArgsSupplier,
    readonly options: ControllerOptions<Controller>,
  ) {
  }

  async initController(): Promise<void> {
    if (this.options.init) {
      await this.options.init();
    }
  }

  async finalizeController<C extends Controller>(
    handledBy?: ControllerCommandHandler<C>,
  ): Promise<void> {
    if (this.options.finalize) {
      await this.options.finalize();
    }
  }

  async doctor() {
    if (this.options.doctor) {
      await this.options.doctor();
    }
  }

  async interpolate(): Promise<void> {
    const { "<tmpl-src-file>": srcFiles } = this.cli.cliArgs;
    if (srcFiles && Array.isArray(srcFiles)) {
      const state: MultiTemplateInterpolationState<Controller> = {
        controller: this,
        global: {},
        history: [],
      };
      for (const srcFile of srcFiles) {
        const { content, ctx, local } = await this.options.interpolate(
          state,
          srcFile,
        );
        state.history.push({ ctx, local });
        console.log(content);
      }
    } else {
      console.error(`No source files supplied.`);
    }
  }

  async handleCLI(): Promise<boolean> {
    const { "interpolate": interpolate } = this.cli.cliArgs;
    if (interpolate) {
      await this.interpolate();
      return true;
    }

    const { "doctor": doctor } = this.cli.cliArgs;
    if (doctor) {
      await this.doctor();
      return true;
    }

    return false;
  }
}

export async function cliHandler(ctx: Controller): Promise<true | void> {
  if (await ctx.handleCLI()) return true;
}

export async function versionHandler(
  ctx: Controller,
): Promise<true | void> {
  const { "version": version } = ctx.cli.cliArgs;
  if (version) {
    console.log(
      `PgDCP Controller ${
        colors.yellow(await determineVersion(import.meta.url))
      }`,
    );
    return true;
  }
}

export const commonHandlers = [
  cliHandler,
  versionHandler,
];

export interface CommandHandlerSpecOptions<C extends Controller> {
  readonly docoptSpec?: (caller: CommandHandlerCaller) => string;
  readonly prepareControllerOptions?: (
    caller: CommandHandlerCaller,
    cliArgs: docopt.DocOptions,
    interpolate: Interpolator<C>,
  ) => ControllerOptions<Controller>;
  readonly prepareController?: (
    caller: CommandHandlerCaller,
    cliArgs: docopt.DocOptions,
    options: ControllerOptions<Controller>,
  ) => C;
}

export async function CLI<
  C extends Controller,
>(
  caller: CommandHandlerCaller,
  options: CommandHandlerSpecOptions<C> = {},
): Promise<void> {
  const { prepareController } = options;
  try {
    const docoptSpecFn = options.docoptSpec || defaultDocoptSpec;
    const prepareControllerOptions = options.prepareControllerOptions ||
      controllerOptions;
    const cliArgs = docopt.default(docoptSpecFn(caller));
    const pchOptions = prepareControllerOptions(
      caller,
      cliArgs,
      typicalInterpolator(
        flexibleTemplateSupplier(),
        typicalInterpolationContext,
      ),
    );
    const context = prepareController
      ? prepareController(caller, cliArgs, pchOptions)
      : new Controller({ cliArgs }, pchOptions);
    await context.initController();
    let handledBy: ControllerCommandHandler<C> | undefined;
    for (const handler of commonHandlers) {
      if (await handler(context)) {
        handledBy = handler;
        break;
      }
    }
    if (!handledBy) {
      console.error("Unable to handle validly parsed docoptSpec:");
      console.dir(cliArgs);
    }
    await context.finalizeController(handledBy);
  } catch (e) {
    console.error(e.message);
  }
}

if (import.meta.main) {
  // Read variables either from the environment or .env. `safe` is set to true
  // so that we are sure that all the variables we need are supplied or we error
  // out. `export` is set to true so that the variables are put into Deno.env().
  dotenv.config({ safe: true, export: true });

  await CLI({
    calledFromMain: import.meta.main,
    calledFromMetaURL: import.meta.url,
    version: await determineVersion(import.meta.url),
  });
}
