import { inflect, path } from "../deps.ts";
import * as SQLa from "../sqla.ts";

export class TypicalSchemaExtension implements SQLa.PostgreSqlExtension {
  readonly searchPath: SQLa.PostgreSqlSchema[];

  constructor(
    readonly name: SQLa.PostgreSqlExtensionName,
    readonly schema: SQLa.PostgreSqlSchema,
  ) {
    this.searchPath = [this.schema];
  }

  readonly createSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `CREATE EXTENSION IF NOT EXISTS ${this.name} SCHEMA ${this.schema.name}`;
  };

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP EXTENSION IF EXISTS ${this.name}`;
  };
}

export function tableColumnName(
  name: SQLa.SqlTableColumnNameFlexible,
  suggestion?: SQLa.SqlTableColumnName,
): SQLa.SqlTableColumnName {
  return typeof name === "string" ? name : name(suggestion);
}

export class TypicalTableColumnInstance implements SQLa.SqlTableColumn {
  readonly isNotNullable?: boolean;
  readonly defaultSqlExpr?: SQLa.PostgreSqlDomainDefaultExpr;
  readonly isPrimaryKey?: boolean;
  readonly foreignKeyDecl?: SQLa.SqlTableColumnForeignKeyExpr;
  readonly tableConstraintsSql?:
    | SQLa.PostgreSqlStatementSupplier
    | SQLa.PostgreSqlStatementSupplier[];
  readonly tableIndexesSql?:
    | SQLa.PostgreSqlStatementSupplier
    | SQLa.PostgreSqlStatementSupplier[];
  readonly foreignKey?: SQLa.SqlTableColumnReference;
  readonly tableQualifiedName: SQLa.SqlTableColumnQualifiedName;
  readonly schemaQualifiedName: SQLa.SqlTableColumnQualifiedName;
  readonly operatorSql?: SQLa.PostgreSqlOperatorExprs;

  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly table: SQLa.SqlTable,
    readonly name: SQLa.SqlTableColumnNameFlexible,
    readonly dataType: SQLa.PostgreSqlDomainDataType,
    readonly options?: SQLa.SqlTableColumnOptions,
  ) {
    this.isNotNullable = this.options?.isNotNullable;
    this.defaultSqlExpr = this.options?.defaultSqlExpr;
    this.isPrimaryKey = this.options?.isPrimaryKey;
    this.foreignKeyDecl = this.options?.foreignKeyDecl;
    this.tableConstraintsSql = this.options?.tableConstraintsSql;
    this.tableIndexesSql = this.options?.tableIndexesSql;
    this.foreignKey = this.options?.foreignKey;
    this.operatorSql = this.options?.operatorSql;
    this.tableQualifiedName = this.table
      .qualifiedReference(tableColumnName(this.name));
    this.schemaQualifiedName = this.schema
      .qualifiedReference(this.table
        .qualifiedReference(tableColumnName(this.name)));
  }

  readonly tableColumnDeclSql: SQLa.PostgreSqlStatementSupplier = () => {
    const options: string[] = [];
    if (this.isNotNullable) options.push("NOT NULL");
    if (this.isPrimaryKey) options.push("PRIMARY KEY");
    if (this.defaultSqlExpr) {
      options.push(`default ${this.defaultSqlExpr}`);
    }
    if (this.foreignKeyDecl) {
      options.push(this.foreignKeyDecl);
    }
    if (this.foreignKey) {
      options.push(
        `REFERENCES ${this.foreignKey.table.qName}(${this.foreignKey.column.name})`,
      );
    }
    return `${tableColumnName(this.name)} ${this.dataType}${
      options.length > 0 ? ` ${options.join(" ")}` : ""
    }`;
  };

  readonly castSql = (
    expr: SQLa.PostgreSqlDomainCastExpr,
  ): SQLa.PostgreSqlDomainCastExpr => {
    return `(${expr})::${this.dataType}`;
  };

  readonly compareEqualSql = (
    left: SQLa.SqlTableColumnQualifiedName,
    right: SQLa.PostgreSqlCompareColumnExpr,
  ): SQLa.PostgreSqlCompareColumnExpr => {
    return this.operatorSql
      ? `${left} ${this.operatorSql.equal} ${right}`
      : `${left} = ${right}`;
  };
}

export interface TableColumnsSupplier {
  (state: SQLa.DcpTemplateState, table: SQLa.SqlTable): TypicalTableColumns;
}

export interface TypicalTableColumns {
  readonly all: SQLa.SqlTableColumn[];
  readonly unique?: {
    name: SQLa.SqlTableConstraintName;
    columns: SQLa.SqlTableColumn[];
  }[];
}

export interface SqlTableCreationComponents {
  readonly columns: SQLa.SqlTableColumn[];
  readonly constraints?: SQLa.PostgreSqlStatement[];
  readonly appendix?: SQLa.PostgreSqlStatement[];
}

export abstract class TypicalView implements SQLa.SqlView {
  readonly qName: SQLa.PostgreSqlSchemaViewQualifiedName;
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly name: SQLa.SqlViewName,
  ) {
    this.qName = this.state.schema.qualifiedReference(this.name);
  }

  // this is a special template literal function named SQL so that Visual
  // Studio code will properly syntax highlight the content
  SQL(
    literals: TemplateStringsArray,
    ...expressions: unknown[]
  ): SQLa.PostgreSqlStatement {
    let interpolated = "";
    for (let i = 0; i < expressions.length; i++) {
      interpolated += literals[i];
      interpolated += expressions[i];
    }
    interpolated += literals[literals.length - 1];
    return interpolated;
  }

  qualifiedReference(qualify: string) {
    return `${this.name}.${qualify}`;
  }

  abstract readonly createSql: SQLa.PostgreSqlStatementSupplier;

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP VIEW IF EXISTS ${this.qName}`;
  };
}

export abstract class TypicalTable implements SQLa.SqlTable {
  readonly qName: SQLa.PostgreSqlSchemaTableQualifiedName;
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly name: SQLa.SqlTableName,
  ) {
    this.qName = this.state.schema
      .qualifiedReference(this.name);
  }

  qualifiedReference(qualify: string) {
    return `${this.name}.${qualify}`;
  }

  abstract get columns(): TypicalTableColumns;

  prepareCreateComponents(
    state: SQLa.DcpTemplateState,
  ): SqlTableCreationComponents {
    const columns = this.columns;
    const constraints: SQLa.PostgreSqlStatement[] = [];
    const appendix: SQLa.PostgreSqlStatement[] = [];

    for (const c of columns.all) {
      const tcs = c.tableConstraintsSql;
      if (Array.isArray(tcs)) {
        constraints.push(...tcs.map((tc) => tc(state)));
      } else if (tcs) {
        constraints.push(tcs(state));
      }
      const tis = c.tableIndexesSql;
      if (Array.isArray(tis)) {
        appendix.push(...tis.map((tc) => tc(state)));
      } else if (tis) {
        appendix.push(tis(state));
      }
    }
    if (columns.unique) {
      for (const ucs of columns.unique) {
        constraints.push(
          // deno-fmt-ignore
          `CONSTRAINT ${ucs.name} UNIQUE(${ucs.columns.map((c) => c.name).join(", ")})`,
        );
      }
    }

    const components: SqlTableCreationComponents = {
      columns: columns.all,
      constraints: constraints.length > 0 ? constraints : undefined,
      appendix: appendix.length > 0 ? appendix : undefined,
    };
    return components;
  }

  createSql(state: SQLa.DcpTemplateState): SQLa.PostgreSqlStatement {
    const components = this.prepareCreateComponents(state);
    const columns = this.columns;
    const sqlRemarks = (c: SQLa.SqlTableColumn) => {
      const domainReminders = [];
      if (SQLa.isTypedSqlTableColumn(c)) {
        domainReminders.push(c.domain.dataType);
        if (c.domain.isNotNullable) domainReminders.push("NOT NULL");
        if (c.domain.defaultSqlExpr) {
          domainReminders.push(`defaulted`);
        }
        return ` /* domain(${domainReminders.join(", ")}) */`;
      }
      return "";
    };

    // deno-fmt-ignore
    return `CREATE TABLE ${this.qName}(
        ${columns.all.map(c => { return `${c.tableColumnDeclSql(state)}${sqlRemarks(c)}`}).join(",\n        ")}${components.constraints ? ',' : ''}
        ${components.constraints ? components.constraints.join(",\n        ") : '-- no column constraints'}
      );${components.appendix ? `\n      ${components.appendix.join(";\n      ")};` : ''}`;
  }

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP TABLE IF EXISTS ${this.qName}`;
  };

  readonly lcFunctions: SQLa.SqlTableLifecycleFunctions = {
    upsert: () => {
      return {
        name: `${this.name}_upsert`,
        qName: `${this.qName}_upsert`,
        bodyBlockName: `${this.qName.replaceAll(/\./g, "_")}_upsert_body`,
      };
    },
    upserted: () => {
      return {
        name: `${this.name}_upserted`,
        qName: `${this.qName}_upserted`,
        bodyBlockName: `${this.qName.replaceAll(/\./g, "_")}_upserted_body`,
      };
    },
  };
}

export function typicalDelimitedTextSupplier<
  C extends Record<string, unknown>,
  T extends TypicalTable,
>(
  table: T,
  defaultOptions: SQLa.SqlTableDelimitedTextColumnOptions<T> = {
    keepColumn: () => {
      return true;
    },
  },
): SQLa.SqlTableDelimitedTextSupplier<T, C> {
  const prepare = (
    options: SQLa.SqlTableDelimitedTextColumnOptions<T> = defaultOptions,
  ): {
    column: SQLa.SqlTableColumn;
    inflectableColName: inflect.InflectableValue;
    defaultValue: SQLa.SqlTableDelimitedTextColumnContent;
  }[] => {
    const keep = options?.keepColumn
      ? table.columns.all.filter((c) => options?.keepColumn(c, table))
      : table.columns.all;
    return keep.map((c) => {
      return {
        column: c,
        inflectableColName: inflect.snakeCaseValue(
          typeof c.name === "string" ? c.name : c.name(),
        ),
        defaultValue: options?.defaultValue
          ? options?.defaultValue(c, table)
          : ``,
      };
    });
  };
  const supplier: SQLa.SqlTableDelimitedTextSupplier<T, C> = {
    table,
    header: (options?) => {
      const keep = prepare(options);
      return keep.map((k) => `"${k.inflectableColName.inflect()}"`);
    },
    content: (row, options?) => {
      const keep = prepare(options);
      return keep.map((k) => {
        const ccName = inflect.toCamelCase(k.inflectableColName);
        const foundCamelCaseEntry = Object.entries(row).find((e) => {
          return e[0] == ccName;
        });
        if (foundCamelCaseEntry) {
          const columnValue = foundCamelCaseEntry[1];
          return options?.columnValue
            ? (options.columnValue(columnValue, k.column, table))
            : (defaultOptions?.columnValue
              ? defaultOptions.columnValue(columnValue, k.column, table)
              : JSON.stringify(columnValue));
        } else {
          return options?.onColumnNotFound
            ? options?.onColumnNotFound(k.column, table)
            : k.defaultValue;
        }
      });
    },
  };
  return supplier;
}

export interface SqlTableDelimitedTextWriterOptions {
  readonly columnDelim: string;
  readonly recordDelim: string;
  readonly destPath: string;
  readonly fileName: string;
  readonly emitHeader: boolean;
}

export function typicalSqlTableDelimitedTextWriterOptions(
  destPath: string,
  fileName: string,
  inherit?: Partial<SqlTableDelimitedTextWriterOptions>,
): SqlTableDelimitedTextWriterOptions {
  return {
    destPath,
    fileName,
    columnDelim: inherit?.columnDelim || ",",
    recordDelim: inherit?.recordDelim || "\n",
    emitHeader: typeof inherit?.emitHeader === "undefined"
      ? true
      : inherit.emitHeader,
  };
}

export class SqlTableDelimitedTextWriter<
  C extends Record<string, unknown>,
  T extends TypicalTable,
> {
  readonly stream: Deno.File;
  protected rowIndex = 0;

  constructor(
    readonly supplier: SQLa.SqlTableDelimitedTextSupplier<T, C>,
    readonly options: SqlTableDelimitedTextWriterOptions,
  ) {
    this.stream = Deno.openSync(path.join(options.destPath, options.fileName), {
      create: true,
      append: true,
    });
    if (this.options.emitHeader) {
      this.stream.writeSync(
        new TextEncoder().encode(
          supplier.header().join(this.options.columnDelim),
        ),
      );
    }
  }

  close(): void {
    this.stream.close();
  }

  write(
    row: C,
    options?: SQLa.SqlTableDelimitedTextColumnContentOptions<T>,
  ): SQLa.SqlTableDelimitedTextContentRow {
    const content = this.supplier.content(row, options);
    const te = new TextEncoder();
    if (this.rowIndex == 0) {
      if (this.options.emitHeader) {
        this.stream.writeSync(te.encode(this.options.recordDelim));
      }
      this.stream.writeSync(te.encode(
        content.join(this.options.columnDelim),
      ));
    } else {
      this.stream.writeSync(
        te.encode(
          this.options.recordDelim + content.join(this.options.columnDelim),
        ),
      );
    }
    this.rowIndex++;
    return content;
  }
}

export class TypicalTypedTableColumnInstance extends TypicalTableColumnInstance
  implements SQLa.TypedSqlTableColumn {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly table: SQLa.SqlTable,
    readonly name: SQLa.SqlTableColumnNameFlexible,
    readonly domain: SQLa.PostgreSqlDomain,
    readonly options?: SQLa.SqlTableColumnOptions,
  ) {
    super(
      schema,
      table,
      name,
      domain.qName, // for a typed-column, the data type is the domain's name
      { ...options, castSql: domain.castSql },
    );
  }
}

export class TypicalDomain implements SQLa.PostgreSqlDomain {
  readonly isNotNullable?: boolean;
  readonly defaultSqlExpr?: SQLa.PostgreSqlDomainDefaultExpr;
  readonly defaultColumnName: SQLa.SqlTableColumnNameFlexible;
  readonly qName: SQLa.PostgreSqlDomainQualifiedName;
  readonly tableColumn: SQLa.TypedSqlTableColumnSupplier;

  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly name: SQLa.PostgreSqlDomainName,
    readonly dataType: SQLa.PostgreSqlDomainDataType,
    readonly options?: SQLa.PostgreSqlDomainColumnOptions & {
      readonly defaultColumnName?: SQLa.SqlTableColumnNameFlexible;
      readonly tableColumn?: SQLa.TypedSqlTableColumnSupplier;
      readonly overrideTableColOptions?: (
        options?: SQLa.SqlTableColumnOptions,
      ) => SQLa.SqlTableColumnOptions | undefined;
    },
  ) {
    this.defaultColumnName = this.options?.defaultColumnName || this.name;
    this.isNotNullable = this.options?.isNotNullable;
    this.defaultSqlExpr = this.options?.defaultSqlExpr;
    this.qName = this.schema
      .qualifiedReference(this.name);
    this.tableColumn = this.options?.tableColumn ||
      ((table, options?): SQLa.TypedSqlTableColumn => {
        return new TypicalTypedTableColumnInstance(
          this.schema,
          table,
          options?.columnName || this.defaultColumnName,
          this,
          this.options?.overrideTableColOptions
            ? this.options?.overrideTableColOptions(options)
            : options,
        );
      });
  }

  readonly castSql = (
    expr: SQLa.PostgreSqlDomainCastExpr,
  ): SQLa.PostgreSqlDomainCastExpr => {
    return `(${expr})::${this.qName}`;
  };

  readonly createSql: SQLa.PostgreSqlStatementSupplier = () => {
    const options: string[] = [];
    if (this.isNotNullable) options.push("NOT NULL");
    if (this.defaultSqlExpr) {
      options.push(`default ${this.defaultSqlExpr}`);
    }
    // deno-fmt-ignore
    return `BEGIN CREATE DOMAIN ${this.schema.qualifiedReference(this.name)} AS ${this.dataType}${options.length > 0 ? ` ${options.join(" ")}` : ""}; EXCEPTION WHEN duplicate_object THEN null; END`
  };

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP DOMAIN IF EXISTS ${this.schema.qualifiedReference(this.name)}`;
  };
}

export class TypicalDomainReference implements SQLa.PostgreSqlDomainReference {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly prime: SQLa.PostgreSqlDomain,
  ) {
  }

  get reference(): SQLa.PostgreSqlDomain {
    return new TypicalDomain(
      this.schema,
      `${this.prime.name}_ref`,
      this.prime.dataType,
      {
        defaultColumnName: this.prime.name,
      },
    );
  }
}

export class TypicalPostgreSqlSchemaStoredRoutine
  implements SQLa.PostgreSqlStoredRoutine {
  readonly qName: SQLa.PostgreSqlStoredRoutineQualifiedName;
  readonly bodyBlockName: SQLa.PostgreSqlStoredRoutineBodyCodeBlockName;
  constructor(
    readonly ag: SQLa.SqlAffinityGroup,
    readonly name: string,
  ) {
    this.qName = this.ag.qualifiedReference(this.name);
    this.bodyBlockName = `${this.qName.replaceAll(/\./g, "_")}_body`;
  }
}
