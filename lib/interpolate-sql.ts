import { fmt, path, safety, textWhitespace as tw } from "./deps.ts";
import * as interp from "./interpolate.ts";
import * as tmpl from "./templates.ts";

// TODO: add typesafe SQL 'create comment' statements for Postgraphile configuration
// e.g.: comment on table periodical_nature is E'@name periodical_nature\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

export interface DcpTemplateLiteral {
  (
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): DcpInterpolationResult;
}

export interface DcpInterpolationOptions extends interp.InterpolationOptions {
  readonly prependHeaders: boolean;
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
export function SQL(
  ctx: DcpInterpolationContext,
  state: DcpTemplateState,
  options: DcpInterpolationOptions = { prependHeaders: true },
): DcpTemplateLiteral {
  return (literals: TemplateStringsArray, ...expressions: unknown[]) => {
    let interpolated = "";
    if (isDcpTemplateState(state)) {
      if (state.headers.length > 0) {
        const { indent } = state.indentation;
        interpolated = state.headers.map((h) => {
          return indent(h(state));
        }).join("\n") + "\n" + interpolated;
      }
    }
    for (let i = 0; i < expressions.length; i++) {
      interpolated += literals[i];
      interpolated += expressions[i];
    }
    interpolated += literals[literals.length - 1];
    const base = ctx.engine.prepareResult(interpolated, state, options);
    return {
      ...base,
      ctx,
    };
  };
}

export type SqlStatement = string;
export type SqlAffinityGroupName = string;
export type SqlTableName = string;
export type SqlTableQualifiedName = string;
export type PostgreSqlStatement = SqlStatement;
export type PostgreSqlStoredRoutineName = string;
export type PostgreSqlStoredRoutineQualifiedName = string;
export type PostgreSqlSchemaName = string;
export type PostgreSqlExtensionName = string;

export interface PostgreSqlStatementSupplier {
  (state: DcpTemplateState): PostgreSqlStatement;
}

export interface DcpTemplateSupplier {
  (state: DcpTemplateState): string;
}

export interface PostgreSqlExtension {
  readonly name: PostgreSqlExtensionName;
  readonly createSql: PostgreSqlStatementSupplier;
  readonly dropSql: PostgreSqlStatementSupplier;
  readonly searchPath: PostgreSqlSchema[];
}

export interface SqlTable {
  readonly name: SqlTableName;
  readonly qName: SqlTableQualifiedName;
}

export interface PostgreSqlStoredRoutine {
  readonly name: PostgreSqlStoredRoutineName;
  readonly qName: PostgreSqlStoredRoutineQualifiedName;
}

export interface PostgreSqlStoredRoutineSupplier {
  (
    state: DcpTemplateState,
    override?: PostgreSqlStoredRoutineName,
  ): PostgreSqlStoredRoutine;
}

export interface PostgreSqlLifecycleFunctions {
  readonly constructStorage: PostgreSqlStoredRoutineSupplier;
  readonly constructIdempotent: PostgreSqlStoredRoutineSupplier;
  readonly destroyStorage: PostgreSqlStoredRoutineSupplier;
  readonly destroyIdempotent: PostgreSqlStoredRoutineSupplier;
  readonly unitTest: PostgreSqlStoredRoutineSupplier;
  readonly lint: PostgreSqlStoredRoutineSupplier;
  readonly doctor: PostgreSqlStoredRoutineSupplier;
  readonly populateSecrets: PostgreSqlStoredRoutineSupplier;
  readonly populateSeedData: PostgreSqlStoredRoutineSupplier;
  readonly populateExperimentalData: PostgreSqlStoredRoutineSupplier;
}

export interface SqlAffinityGroup {
  readonly name: SqlAffinityGroupName;
  readonly qualifiedReference: (qualify: string) => string;
  readonly setSearchPathSql: PostgreSqlStatementSupplier;
  readonly lcFunctions: PostgreSqlLifecycleFunctions;
}

export interface PostgreSqlSchema extends SqlAffinityGroup {
  readonly name: PostgreSqlSchemaName;
  readonly dependencies?: PostgreSqlSchema[];
  readonly createSchemaSql: PostgreSqlStatementSupplier;
  readonly dropSchemaSql: PostgreSqlStatementSupplier;
  readonly extension: (
    name: PostgreSqlExtensionName,
  ) => PostgreSqlExtension;
}

export interface DcpTemplateState extends interp.InterpolationState {
  readonly ic: DcpInterpolationContext;
  readonly schema: PostgreSqlSchema;
  readonly isSchemaDefaulted: boolean;
  readonly affinityGroup: SqlAffinityGroup | PostgreSqlSchema;
  readonly searchPath: PostgreSqlSchema[];
  readonly indentation: interp.Indentable;
  readonly headers: DcpTemplateSupplier[];
  readonly extensions?: PostgreSqlExtension[];
  readonly setSearchPathSql: (
    prepend?: string | string[],
    append?: string | string[],
  ) => PostgreSqlStatement;
}

export const isDcpTemplateState = safety.typeGuard<DcpTemplateState>(
  "schema",
  "isSchemaDefaulted",
  "searchPath",
);

export interface InterpolationContextStateOptions {
  readonly schema?: PostgreSqlSchema;
  readonly affinityGroup?: SqlAffinityGroup;
  readonly searchPath?: PostgreSqlSchema[];
  readonly extensions?: PostgreSqlExtension[];
  readonly headers?: {
    readonly standalone?: DcpTemplateSupplier[];
    readonly embedded?: DcpTemplateSupplier[];
  };
}

export interface DcpInterpolationResult extends interp.InterpolationResult {
  readonly ctx: DcpInterpolationContext;
  readonly state: DcpTemplateState;
}

export interface DcpInterpolationEngine extends interp.InterpolationEngine {
  readonly prepareResult: (
    interpolated: interp.InterpolatedContent,
    state: interp.InterpolationState,
    options: interp.InterpolationOptions,
  ) => DcpInterpolationResult;
}

export type DcpInterpolationContextVersion = string;

export interface DcpInterpolationContext {
  readonly version: DcpInterpolationContextVersion;
  readonly engine: DcpInterpolationEngine;
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
    irFn: (eic: DcpEmbeddedInterpolationContext) => DcpInterpolationResult,
  ) => interp.InterpolatedContent;
}

export interface DcpEmbeddedInterpolationContext
  extends DcpInterpolationContext {
  readonly parent: interp.InterpolationState;
}

export const isEmbeddedInterpolationContext = safety.typeGuard<
  DcpEmbeddedInterpolationContext
>("parent");

export function typicalDcpInterpolationContext(
  version: DcpInterpolationContextVersion,
  defaultSchema: PostgreSqlSchema,
  hrSrcSupplier: interp.TemplateProvenanceHumanReadableSourceSupplier,
): DcpInterpolationContext {
  const dcpIC: DcpInterpolationContext = {
    version,
    engine: {
      version,
      prepareInterpolation(
        provenance: interp.TemplateProvenance,
      ): interp.InterpolationExecution {
        return {
          provenance,
        };
      },
      prepareResult(
        interpolated: interp.InterpolatedContent,
        state: interp.InterpolationState,
        options: interp.InterpolationOptions,
      ): DcpInterpolationResult {
        if (!isDcpTemplateState(state)) {
          throw Error(
            `prepareResult(): state is expected to be of type DcpTemplateState not ${typeof state}`,
          );
        }
        return {
          ctx: dcpIC,
          state,
          interpolated,
          options,
        };
      },
    },
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
          humanReadableSource: defaultP?.humanReadableSource || hrSrcSupplier,
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
        schema: defaultSchema,
      },
    ): DcpTemplateState => {
      const schema = options.schema || defaultSchema;
      const stateSearchPath = options.searchPath
        ? options.searchPath
        : [schema];
      if (options.extensions) {
        options.extensions.forEach((e) =>
          e.searchPath.forEach((p) => stateSearchPath.push(p))
        );
      }
      const dcpTS: DcpTemplateState = {
        ic: dcpIC,
        ie,
        schema,
        isSchemaDefaulted: options.schema ? false : true,
        affinityGroup: options.affinityGroup ? options.affinityGroup : schema,
        searchPath: stateSearchPath,
        indentation: interp.isIndentable(ie.provenance)
          ? ie.provenance
          : interp.noIndentation,
        headers: typeof options.headers === "undefined"
          ? [
            tmpl.preface,
            tmpl.schema,
            tmpl.searchPath,
            tmpl.extensions,
          ]
          : (options.headers?.standalone || []),
        extensions: options.extensions,
        setSearchPathSql: (prepend?, append?) => {
          const include = (elements?: string | string[]): string[] => {
            return elements
              ? (Array.isArray(elements) ? elements : [elements])
              : [];
          };
          const sp: string[] = [
            ...include(prepend),
            ...stateSearchPath.map((s) => s.name),
            ...include(append),
          ];
          return `SET search_path TO ${[...new Set(sp)].join(", ")}`;
        },
      };
      return dcpTS;
    },
    embed: (
      ic: DcpInterpolationContext,
      parent: DcpTemplateState,
      irFn: (
        eic: DcpEmbeddedInterpolationContext,
      ) => DcpInterpolationResult,
    ): interp.InterpolatedContent => {
      const eic: DcpEmbeddedInterpolationContext = {
        ...ic,
        parent,
        prepareState: (
          ie: interp.InterpolationExecution,
          options: InterpolationContextStateOptions = {
            schema: defaultSchema,
          },
        ): DcpTemplateState => {
          // an embedded template is basically the same as its parent except
          // it might have different headers
          const base = ic.prepareState(ie, options);
          return {
            ...base,
            headers: options?.headers?.embedded || [
              tmpl.embeddedPreface,
              tmpl.schema,
              tmpl.searchPath,
              tmpl.extensions,
            ],
          };
        },
      };
      const eir = irFn(eic);
      if (!isDcpTemplateState(eir.state)) {
        throw Error(
          `embed(): eir.state is expected to be of type DcpTemplateState not ${typeof eir
            .state}`,
        );
      }
      // When embedding, we first add the indented headers expected then
      // unident the embedded interpolation result and finally indent it
      // at the parent's indentation level so that everything aligns
      const { state } = eir;
      return parent.indentation.indent(
        state.indentation.unindent(eir.interpolated),
      );
    },
  };
  return dcpIC;
}

export interface PostgreSqlInterpolationPersistOptions {
  readonly destHome?: string;
  readonly driverFileName?: string;
  readonly includeInDriver: (pir: PersistableSqlInterpolationResult) => boolean;
  readonly persist: (fileName: string, content: string) => Promise<void>;
}

export interface PersistableSqlInterpolationResult
  extends DcpInterpolationResult {
  readonly index: number;
  readonly original: interp.InterpolatedContent;
  readonly fileName: string;
  readonly includeInDriver: boolean;
}

export interface PostgreSqlInterpolationPersistenceFileNameSupplier {
  (
    provenanceNoExtn: string,
    index: number,
    ir: DcpInterpolationResult,
  ): string;
}

export class PostgreSqlInterpolationPersistence {
  readonly unindexedFileName:
    PostgreSqlInterpolationPersistenceFileNameSupplier = (
      provenanceNoExtn: string,
    ): string => {
      return fmt.sprintf("%s.auto.sql", provenanceNoExtn);
    };
  readonly indexedFileName: PostgreSqlInterpolationPersistenceFileNameSupplier =
    (
      provenanceNoExtn: string,
      index: number,
    ): string => {
      return fmt.sprintf("%03d_%s.auto.sql", index, provenanceNoExtn);
    };

  readonly persistable: PersistableSqlInterpolationResult[] = [];

  constructor(
    readonly interpOptions: PostgreSqlInterpolationPersistOptions,
  ) {
  }

  extensionsReferenced(): PostgreSqlExtension[] {
    const uniqueExtns: PostgreSqlExtension[] = [];
    this.persistable.forEach((p) => {
      if (p.state.extensions) {
        p.state.extensions.forEach((reqdExtn) => {
          const found = uniqueExtns.find((e) =>
            reqdExtn.name.toLowerCase() == e.name.toLowerCase()
          );
          if (!found) uniqueExtns.push(reqdExtn);
        });
      }
    });
    return uniqueExtns;
  }

  schemasReferenced(): PostgreSqlSchema[] {
    const uniqueSchemaNames: PostgreSqlSchema[] = [];
    this.persistable.forEach((p) => {
      p.state.searchPath.forEach((s) => {
        const found = uniqueSchemaNames.find((us) =>
          s.name.toLowerCase() == us.name.toLowerCase()
        );
        if (!found) uniqueSchemaNames.push(s);
      });
    });
    return uniqueSchemaNames;
  }

  registerPersistableResult(
    ir: DcpInterpolationResult,
    options: {
      fileName?: PostgreSqlInterpolationPersistenceFileNameSupplier;
      index?: number;
      includeInDriver?: boolean;
    } = {},
  ): PersistableSqlInterpolationResult {
    const { state } = ir;
    const lastIndex = this.persistable.length > 0
      ? this.persistable[this.persistable.length - 1].index
      : -1;
    const index = options.index ? options.index : lastIndex + 1;
    const fnNoExtn = state.ie.provenance.identity.replace(/\..+$/, "");
    const result: PersistableSqlInterpolationResult = {
      ...ir,
      index,
      interpolated: state.indentation.unindent(ir.interpolated),
      original: ir.interpolated,
      fileName: options.fileName
        ? options.fileName(fnNoExtn, index, ir)
        : this.indexedFileName(fnNoExtn, index, ir),
      includeInDriver: typeof options.includeInDriver === "boolean"
        ? options.includeInDriver
        : true,
    };
    this.persistable.push(result);
    return result;
  }

  async persistResult(result: PersistableSqlInterpolationResult) {
    if (this.interpOptions.destHome) {
      const fileName = path.join(
        this.interpOptions.destHome,
        result.fileName,
      );
      await this.interpOptions.persist(fileName, result.interpolated);
    } else {
      console.log(result.interpolated);
    }
  }

  async persistResults(): Promise<void> {
    await Promise.all(this.persistable.map((p) => this.persistResult(p)));
    if (this.interpOptions.destHome && this.interpOptions.driverFileName) {
      const fileName = path.join(
        this.interpOptions.destHome,
        this.interpOptions.driverFileName,
      );
      const driver = this.persistable.filter((pir) => pir.includeInDriver)
        .map((pir) => {
          return tw.unindentWhitespace(`\\ir ${pir.fileName}`);
        }).join("\n");
      await this.interpOptions.persist(fileName, driver);
    }
  }
}
