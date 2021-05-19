import { fs, inflect, path } from "../deps.ts";
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

export class TypicalTableColumnInstance<TypeScriptValue>
  implements SQLa.SqlTableColumn<TypeScriptValue> {
  readonly isNotNullable?: boolean;
  readonly defaultSqlExpr?: SQLa.PostgreSqlDomainDefaultExpr;
  readonly defaultStaticValue?: () => TypeScriptValue;
  readonly defaultDelimitedTextValue?: () => string;
  readonly isPrimaryKey?: boolean;
  readonly foreignKeyDecl?: SQLa.SqlTableColumnForeignKeyExpr;
  readonly tableConstraintsSql?:
    | SQLa.PostgreSqlStatementSupplier
    | SQLa.PostgreSqlStatementSupplier[];
  readonly tableIndexesSql?:
    | SQLa.PostgreSqlStatementSupplier
    | SQLa.PostgreSqlStatementSupplier[];
  readonly foreignKey?: SQLa.SqlTableColumnReference<unknown>;
  readonly tableQualifiedName: SQLa.SqlTableColumnQualifiedName;
  readonly schemaQualifiedName: SQLa.SqlTableColumnQualifiedName;
  readonly operatorSql?: SQLa.PostgreSqlOperatorExprs;

  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly table: SQLa.SqlTable,
    readonly name: SQLa.SqlTableColumnNameFlexible,
    readonly dataType: SQLa.PostgreSqlDomainDataType,
    readonly options?: SQLa.SqlTableColumnOptions<TypeScriptValue>,
  ) {
    this.isNotNullable = this.options?.isNotNullable;
    this.defaultSqlExpr = this.options?.defaultSqlExpr;
    this.defaultStaticValue = this.options?.defaultStaticValue;
    this.defaultDelimitedTextValue = this.options?.defaultDelimitedTextValue;
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
  readonly all: SQLa.SqlTableColumn<unknown>[];
  readonly unique?: {
    name: SQLa.SqlTableConstraintName;
    columns: SQLa.SqlTableColumn<unknown>[];
  }[];
}

export interface SqlTableCreationComponents {
  readonly columns: SQLa.SqlTableColumn<unknown>[];
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
    const sqlRemarks = (c: SQLa.SqlTableColumn<unknown>) => {
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
    return `CREATE TABLE IF NOT EXISTS ${this.qName}(
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
  R extends Record<string, unknown>,
  T extends TypicalTable,
>(
  table: T,
  defaultOptions: SQLa.SqlTableDelimitedTextColumnOptions<R, T> = {
    keepColumn: () => {
      return true;
    },
  },
): SQLa.SqlTableDelimitedTextSupplier<R, T> {
  const prepare = (
    record: R | undefined,
    options?: Omit<SQLa.SqlTableDelimitedTextColumnOptions<R, T>, "keepColumn">,
  ): {
    column: SQLa.SqlTableColumn<unknown>;
    inflectableColName: inflect.InflectableValue;
    colRecFieldName: SQLa.SqlTableColumnNameCamelCase;
    defaultValue: SQLa.SqlTableDelimitedTextColumnContent;
  }[] => {
    const keep = table.columns.all.filter((c) =>
      defaultOptions.keepColumn(c, table)
    );
    return keep.map((c) => {
      const inflectableColName = inflect.snakeCaseValue(
        typeof c.name === "string" ? c.name : c.name(),
      );
      const colRecFieldName = inflect.toCamelCase(inflectableColName);
      return {
        record,
        column: c,
        inflectableColName,
        colRecFieldName,
        defaultValue: (record && options?.defaultValue)
          ? options.defaultValue(colRecFieldName, c, record, table)
          : (c.defaultDelimitedTextValue ? c.defaultDelimitedTextValue() : ``),
      };
    });
  };
  const supplier: SQLa.SqlTableDelimitedTextSupplier<R, T> = {
    table,
    header: (options?) => {
      const keep = prepare(undefined, options);
      return keep.map((k) => {
        return {
          header: `"${k.inflectableColName.inflect()}"`,
          column: k.column,
        };
      });
    },
    content: (row, rowIndex, options?) => {
      const keep = prepare(row, options);
      return {
        record: row,
        rowIndex,
        row: keep.map((k) => {
          const ccName = inflect.toCamelCase(k.inflectableColName);
          const foundCamelCaseEntry = Object.entries(row).find((e) => {
            return e[0] == ccName;
          });
          if (foundCamelCaseEntry) {
            let columnValue = foundCamelCaseEntry[1];
            if (columnValue === null || typeof columnValue === "undefined") {
              columnValue = k.defaultValue;
            }
            return {
              value: options?.columnValue
                ? (options.columnValue(columnValue, k.column, table))
                : (defaultOptions?.columnValue
                  ? defaultOptions.columnValue(columnValue, k.column, table)
                  : JSON.stringify(columnValue)),
              column: k.column,
            };
          } else {
            return {
              value: options?.onColumnNotFoundInRecord
                ? options.onColumnNotFoundInRecord(
                  k.colRecFieldName,
                  k.column,
                  row,
                  table,
                )
                : k.defaultValue,
              column: k.column,
            };
          }
        }),
      };
    },
  };
  return supplier;
}

export interface SqlTableDelimitedTextWriterOptions<
  C extends Record<string, unknown>,
> {
  readonly columnDelim: string;
  readonly recordDelim: string;
  readonly destPath: string;
  readonly fileName: string;
  readonly emitHeader: boolean;
  readonly values?: SQLa.SqlTableDelimitedTextContentRows<C>;
}

export function typicalSqlTableDelimitedTextWriterOptions<
  C extends Record<string, unknown>,
>(
  destPath: string,
  fileName: string,
  inherit?: Partial<SqlTableDelimitedTextWriterOptions<C>>,
): SqlTableDelimitedTextWriterOptions<C> {
  return {
    destPath,
    fileName,
    columnDelim: inherit?.columnDelim || ",",
    recordDelim: inherit?.recordDelim || "\n",
    emitHeader: typeof inherit?.emitHeader === "undefined"
      ? true
      : inherit.emitHeader,
    values: inherit?.values,
  };
}

export class SqlTableDelimitedTextWriter<
  R extends Record<string, unknown>,
  T extends SQLa.SqlTable,
> {
  readonly stream: Deno.File;
  readonly values?: SQLa.SqlTableDelimitedTextContentRows<R>;
  protected rowIndex = 0;

  constructor(
    readonly table: T,
    readonly supplier: SQLa.SqlTableDelimitedTextSupplier<R, T>,
    readonly writerOptions: SqlTableDelimitedTextWriterOptions<R>,
  ) {
    fs.ensureDirSync(writerOptions.destPath);
    this.stream = Deno.openSync(
      path.join(writerOptions.destPath, writerOptions.fileName),
      {
        create: true,
        write: true,
        append: false,
      },
    );
    this.values = writerOptions.values;
    if (this.writerOptions.emitHeader) {
      this.stream.writeSync(
        new TextEncoder().encode(
          supplier.header().map((c) => c.header).join(
            this.writerOptions.columnDelim,
          ),
        ),
      );
    }
  }

  close(): void {
    this.stream.close();
  }

  write(
    row: R,
    options?: Omit<SQLa.SqlTableDelimitedTextColumnOptions<R, T>, "keepColumn">,
  ): [written: boolean, row: SQLa.SqlTableDelimitedTextContentRow<R>] {
    const content = this.supplier.content(row, this.rowIndex, options);
    if (this.values) {
      // if we care about unique records, we'll track the values in memory
      const [exists, written] = this.values.insert(content);
      if (exists) return [false, written];
    }
    const te = new TextEncoder();
    if (
      (this.rowIndex == 0 && this.writerOptions.emitHeader) || this.rowIndex > 0
    ) {
      this.stream.writeSync(te.encode(this.writerOptions.recordDelim));
    }
    this.stream.writeSync(te.encode(
      content.row.map((c) => c.value).join(this.writerOptions.columnDelim),
    ));
    this.rowIndex++;
    return [true, content];
  }

  writeReturning(
    row: R,
    options?: Omit<SQLa.SqlTableDelimitedTextColumnOptions<R, T>, "keepColumn">,
  ): [R, SQLa.SqlTableDelimitedTextContentRow<R>, boolean] {
    const content = this.write(row, options);
    const result: Record<string, unknown> = {};
    content[1].row.forEach((c) => {
      const inflectableColName = inflect.snakeCaseValue(
        typeof c.column.name === "string" ? c.column.name : c.column.name(),
      );
      const camelCaseColName = inflect.toCamelCase(inflectableColName);
      result[camelCaseColName] = c.value;
    });
    return [result as R, content[1], content[0]];
  }
}

export class TypicalTypedTableColumnInstance<TypeScriptValue>
  extends TypicalTableColumnInstance<TypeScriptValue>
  implements SQLa.TypedSqlTableColumn<TypeScriptValue> {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly table: SQLa.SqlTable,
    readonly name: SQLa.SqlTableColumnNameFlexible,
    readonly domain: SQLa.PostgreSqlDomain<TypeScriptValue>,
    readonly options?: SQLa.SqlTableColumnOptions<TypeScriptValue>,
  ) {
    super(
      schema,
      table,
      name,
      domain.qName, // for a typed-column, the data type is the domain's name
      {
        defaultStaticValue: domain.defaultStaticValue,
        defaultDelimitedTextValue: domain.defaultDelimitedTextValue,
        ...options, // if the above are provided in column options, they'll override
        castSql: domain.castSql,
      },
    );
  }
}

export class TypicalDomain<TypeScriptValue>
  implements SQLa.PostgreSqlDomain<TypeScriptValue> {
  readonly isNotNullable?: boolean;
  readonly defaultSqlExpr?: SQLa.PostgreSqlDomainDefaultExpr;
  readonly defaultStaticValue?: () => TypeScriptValue;
  readonly defaultDelimitedTextValue?: () => string;
  readonly defaultColumnName: SQLa.SqlTableColumnNameFlexible;
  readonly qName: SQLa.PostgreSqlDomainQualifiedName;
  readonly tableColumn: SQLa.TypedSqlTableColumnSupplier<TypeScriptValue>;

  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly name: SQLa.PostgreSqlDomainName,
    readonly dataType: SQLa.PostgreSqlDomainDataType,
    readonly options?: SQLa.PostgreSqlDomainColumnOptions<TypeScriptValue> & {
      readonly defaultColumnName?: SQLa.SqlTableColumnNameFlexible;
      readonly tableColumn?: SQLa.TypedSqlTableColumnSupplier<TypeScriptValue>;
      readonly overrideTableColOptions?: (
        options?: SQLa.SqlTableColumnOptions<TypeScriptValue>,
      ) => SQLa.SqlTableColumnOptions<TypeScriptValue> | undefined;
    },
  ) {
    this.defaultColumnName = this.options?.defaultColumnName || this.name;
    this.isNotNullable = this.options?.isNotNullable;
    this.defaultSqlExpr = this.options?.defaultSqlExpr;
    this.defaultStaticValue = this.options?.defaultStaticValue;
    this.defaultDelimitedTextValue = this.options?.defaultDelimitedTextValue;
    this.qName = this.schema
      .qualifiedReference(this.name);
    this.tableColumn = this.options?.tableColumn ||
      ((table, options?): SQLa.TypedSqlTableColumn<TypeScriptValue> => {
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

export class TypicalDomainReference<TypeScriptValue>
  implements SQLa.PostgreSqlDomainReference<TypeScriptValue> {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly prime: SQLa.PostgreSqlDomain<TypeScriptValue>,
  ) {
  }

  get reference(): SQLa.PostgreSqlDomain<TypeScriptValue> {
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
