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
} from "./deps.ts";
import * as core from "./core.ts";
import * as git from "./git.ts";

export interface ExecutionContext {
  readonly calledFromMetaURL: string;
  readonly version?: string;
  readonly projectHome?: string;
}

export interface CliExecutionContext extends ExecutionContext {
  readonly cliArgs: docopt.DocOptions;
}

export const isCliExecutionContext = safety.typeGuard<CliExecutionContext>(
  "cliArgs",
);

export interface ControllerOptions {
  readonly projectHome: string;
  readonly transactionID: string;
  readonly isVerbose: boolean;
  readonly isDryRun: boolean;
  readonly buildHostID: string;

  readonly interpolate: () => core.PostgreSqlInterpolationEngineOptions;
  readonly mkDirs: (dirs: string) => void;
}

export function cliControllerOptions(
  ec: CliExecutionContext,
): ControllerOptions {
  const {
    "--project": projectArg,
    "--verbose": verboseArg,
    "--dry-run": dryRunArg,
    "--tx-id": transactionIdArg,
  } = ec.cliArgs;
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
      const interpOptions: core.PostgreSqlInterpolationEngineOptions = {
        destHome: destHome ? destHome as string : undefined,
        driverFileName: driverFileName ? driverFileName as string : undefined,
        includeInDriver: (pir) => {
          return pir.includeInDriver;
        },
        persist: async (fileName, content) => {
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
          if (!isDryRun) {
            Deno.writeTextFileSync(fileName, content);
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
    readonly ec: ExecutionContext,
    readonly options: ControllerOptions,
  ) {
  }

  async interpolationEngine(
    interpOptions: core.PostgreSqlInterpolationEngineOptions,
    dcpSS: core.DataComputingPlatformSqlSupplier,
  ): Promise<core.PostgreSqlInterpolationEngine> {
    return new core.PostgreSqlInterpolationEngine(
      await this.determineVersion(),
      interpOptions,
      dcpSS,
    );
  }

  abstract interpolate(
    interpOptions: core.PostgreSqlInterpolationEngineOptions,
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

export function cliArgs(caller: ExecutionContext): CliExecutionContext {
  const docOptSpec = tw.unindentWhitespace(`
    PgDCP Controller ${caller.version}.

    Usage:
    dcpctl interpolate [--dest=<dest-home>] [--driver=<driver-file>] [--dry-run] [--verbose] [--git-status]
    dcpctl version
    dcpctl -h | --help

    Options:
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
