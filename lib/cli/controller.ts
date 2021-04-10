import {
  colors,
  docopt,
  fs,
  govnSvcVersion as gsv,
  path,
  pattern,
  safety,
  textWhitespace as tw,
  uuid,
} from "../deps.ts";
import * as SQLaT from "../typical/mod.ts";
import * as git from "./git.ts";

export type ExecutionContextID = string;

export interface ExecutionContext {
  readonly identity: ExecutionContextID;
  readonly isExperimental: boolean;
}

export const execContexts: ExecutionContext[] = [
  { identity: "sandbox", isExperimental: true },
  { identity: "devl", isExperimental: true },
  { identity: "test", isExperimental: false },
  { identity: "production", isExperimental: false },
];

export interface CallerOptions {
  readonly calledFromMetaURL: string;
  readonly version?: string;
  readonly projectHome?: string;
  readonly context?: ExecutionContext;
}

export interface CliCallerOptions extends CallerOptions {
  readonly cliArgs: docopt.DocOptions;
}

export const isCliExecutionContext = safety.typeGuard<CliCallerOptions>(
  "cliArgs",
);

export interface ControllerOptions {
  readonly context: ExecutionContext;
  readonly projectHome: string;
  readonly transactionID: string;
  readonly isVerbose: boolean;
  readonly isDryRun: boolean;
  readonly buildHostID: string;

  readonly interpolate: () => SQLaT.PostgreSqlInterpolationPersistOptions;
  readonly mkDirs: (dirs: string) => void;
}

export function cliControllerOptions(
  ec: CliCallerOptions,
): ControllerOptions {
  const {
    "--context": contextArg,
    "--project": projectArg,
    "--verbose": verboseArg,
    "--dry-run": dryRunArg,
    "--tx-id": transactionIdArg,
  } = ec.cliArgs;
  // context is required, let's make sure it's typed properly
  const context = execContexts.find((ec) =>
    ec.identity == (contextArg as string)
  );
  if (!context) {
    throw Error(
      `--context=${contextArg} must be one of [${
        execContexts.map((ec) => ec.identity).join(", ")
      }]`,
    );
  }

  const projectHomeDefault = projectArg
    ? projectArg as string
    : (ec.projectHome || Deno.cwd());
  const projectHomeRel = path.isAbsolute(projectHomeDefault)
    ? path.relative(Deno.cwd(), projectHomeDefault)
    : projectHomeDefault;
  const projectHomeAbs = path.resolve(Deno.cwd(), projectHomeRel);
  const isDryRun = dryRunArg ? true : false;
  const isVerbose = isDryRun || (verboseArg ? true : false);
  const transactionID = transactionIdArg
    ? transactionIdArg.toString()
    : uuid.v4.generate();

  const ctlOptions: ControllerOptions = {
    context,
    projectHome: projectHomeAbs,
    transactionID,
    isDryRun,
    isVerbose,
    buildHostID: Deno.hostname(),
    mkDirs: (dirs: string) => {
      if (!fs.existsSync(dirs)) {
        if (isVerbose || isDryRun) {
          console.log(`mkdir -p ${colors.yellow(dirs)}`);
        }
        if (!isDryRun) {
          Deno.mkdirSync(dirs, { recursive: true });
        }
      }
    },
    interpolate: () => {
      const {
        "--dest": destHome,
        "--driver": driverFileName,
        "--git-status": showGitStatus,
      } = ec.cliArgs;
      const interpOptions: SQLaT.PostgreSqlInterpolationPersistOptions = {
        destHome: destHome ? destHome as string : undefined,
        driverFileName: driverFileName ? driverFileName as string : undefined,
        includeInDriver: (pir) => {
          return pir.includeInDriver;
        },
        persist: async (fileName, content) => {
          if (!isDryRun) {
            Deno.writeTextFileSync(fileName, content);
          }
          if (isDryRun || isVerbose) {
            const gs = showGitStatus ? await git.gitStatus(fileName) : {
              fileName: fileName,
              statusCode: "!!",
              status: {
                colored: (text: string) => {
                  return colors.brightCyan(text);
                },
                label: "",
              },
            };
            const basename = path.basename(fileName);
            console.log(
              colors.dim(path.dirname(fileName) + "/") +
                (gs
                  ? (gs.status.colored(basename) + " " +
                    colors.dim("(" + gs.status.label + ")"))
                  : basename),
            );
          }
        },
      };
      if (interpOptions.destHome) ctlOptions.mkDirs(interpOptions.destHome);
      return interpOptions;
    },
  };
  return ctlOptions;
}

export abstract class Controller {
  constructor(
    readonly ec: CallerOptions,
    readonly options: ControllerOptions,
  ) {
  }

  abstract interpolate(
    interpOptions: SQLaT.PostgreSqlInterpolationPersistOptions,
  ): Promise<void>;

  async handleCLI(): Promise<void> {
    if (!isCliExecutionContext(this.ec)) {
      throw Error("Expecting CLI execution environment");
    }
    const { cliArgs } = this.ec;
    await pattern.match(cliArgs)
      .with(
        { interpolate: true },
        async () => {
          await this.interpolate(this.options.interpolate());
        },
      )
      .with(
        { version: true },
        async () => {
          console.log(
            `PgDCP Controller ${
              colors.yellow(await this.determineVersion(import.meta.url))
            }`,
          );
        },
      )
      .otherwise(() => {
        console.log("Unable to handle valid CLI arguments");
        console.dir(cliArgs);
      });
  }

  async determineVersion(
    importMetaURL: string = import.meta.url,
  ): Promise<string> {
    return this.ec.version || await gsv.determineVersionFromRepoTag(
      importMetaURL,
      { repoIdentity: "PgDCP" },
    );
  }
}

export function cliArgs(caller: CallerOptions): CliCallerOptions {
  const docOptSpec = tw.unindentWhitespace(`
    PgDCP Controller ${caller.version}.

    Usage:
    dcpctl interpolate --context=<context> [--dest=<dest-home>] [--driver=<driver-file>] [--dry-run] [--verbose] [--git-status]
    dcpctl version
    dcpctl -h | --help

    Options:
    --context=<context>     The execution context we're operating in (sandbox, prod, etc.)
    --dest=<dest-home>      Path where destination file(s) should be stored (STDOUT otherwise)
    --driver=<driver-file>  The name of the PostgreSQL driver file to create [default: driver.auto.psql]
    --git-status            When showing files, color output using Git label porcelain parser [default: false]
    --dry-run               Show what will be done (but don't actually do it) [default: false]
    --verbose               Be explicit about what's going on [default: false]
    -h --help               Show this screen
  `);
  return {
    ...caller,
    cliArgs: docopt.default(docOptSpec),
  };
}

export async function CLI(ctl: Controller): Promise<void> {
  await ctl.handleCLI();
}

// if (import.meta.main) {
//   dotenv.config({ safe: true, export: true });
//   const cliEC = cliArgs({
//     calledFromMetaURL: import.meta.url,
//   });
//   await CLI(new Controller(cliEC, cliControllerOptions(cliEC)));
// }
