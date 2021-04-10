import { fmt, path, textWhitespace as tw } from "../deps.ts";
import * as SQLa from "../sqla.ts";
import * as interp from "../interpolate.ts";

export interface PostgreSqlInterpolationPersistOptions {
  readonly destHome?: string;
  readonly driverFileName?: string;
  readonly includeInDriver: (pir: PersistableSqlInterpolationResult) => boolean;
  readonly persist: (fileName: string, content: string) => Promise<void>;
}

export interface PersistableSqlInterpolationResult
  extends SQLa.DcpInterpolationResult {
  readonly index: number;
  readonly original: interp.InterpolatedContent;
  readonly fileName: string;
  readonly includeInDriver: boolean;
}

export interface PostgreSqlInterpolationPersistenceFileNameSupplier {
  (
    provenanceNoExtn: string,
    index: number,
    ir: SQLa.DcpInterpolationResult,
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

  extensionsReferenced(): SQLa.PostgreSqlExtension[] {
    const uniqueExtns: SQLa.PostgreSqlExtension[] = [];
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

  schemasReferenced(): SQLa.PostgreSqlSchema[] {
    const uniqueSchemaNames: SQLa.PostgreSqlSchema[] = [];
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
    ir: SQLa.DcpInterpolationResult,
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
