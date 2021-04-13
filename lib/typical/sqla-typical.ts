import * as SQLa from "../sqla.ts";

export class TypicalSchemaExtension implements SQLa.PostgreSqlExtension {
  constructor(
    readonly name: SQLa.PostgreSqlExtensionName,
    readonly schema: SQLa.PostgreSqlSchema,
  ) {
  }

  readonly createSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `CREATE EXTENSION IF NOT EXISTS ${this.name} SCHEMA ${this.schema.name}`;
  };

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP EXTENSION IF EXISTS ${this.name}`;
  };

  readonly searchPath = [this.schema];
}

export function tableColumnName(
  name: SQLa.SqlTableColumnNameFlexible,
  suggestion?: SQLa.SqlTableColumnName,
): SQLa.SqlTableColumnName {
  return typeof name === "string" ? name : name(suggestion);
}

export class TypicalTableColumnInstance implements SQLa.SqlTableColumn {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly table: SQLa.SqlTable,
    readonly name: SQLa.SqlTableColumnNameFlexible,
    readonly dataType: SQLa.PostgreSqlDomainDataType,
    readonly options?: SQLa.SqlTableColumnOptions,
  ) {
  }

  readonly isNotNullable = this.options?.isNotNullable;
  readonly isPrimaryKey = this.options?.isPrimaryKey;
  readonly foreignKeyDecl = this.options?.foreignKeyDecl;
  readonly foreignKey = this.options?.foreignKey;
  readonly defaultSqlExpr = this.options?.defaultSqlExpr;
  readonly tableConstraintsSql = this.options?.tableConstraintsSql;
  readonly tableIndexesSql = this.options?.tableIndexesSql;

  readonly tableQualifiedName: SQLa.SqlTableColumnQualifiedName = this.table
    .qualifiedReference(tableColumnName(this.name));

  readonly schemaQualifiedName: SQLa.SqlTableColumnQualifiedName = this.schema
    .qualifiedReference(this.table
      .qualifiedReference(tableColumnName(this.name)));

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
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly name: SQLa.SqlViewName,
  ) {
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

  qName: SQLa.PostgreSqlSchemaViewQualifiedName = this.state.schema
    .qualifiedReference(this.name);

  qualifiedReference(qualify: string) {
    return `${this.name}.${qualify}`;
  }

  abstract readonly createSql: SQLa.PostgreSqlStatementSupplier;

  readonly dropSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP VIEW IF EXISTS ${this.qName}`;
  };
}

export abstract class TypicalTable implements SQLa.SqlTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly name: SQLa.SqlTableName,
  ) {
  }

  qName: SQLa.PostgreSqlSchemaTableQualifiedName = this.state.schema
    .qualifiedReference(this.name);

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
      domain.dataType,
      options,
    );
  }

  // for a typed-column, the data type is the domain's name
  readonly dataType = this.domain.qName;
  readonly castSql = this.domain.castSql;
}

export class TypicalDomain implements SQLa.PostgreSqlDomain {
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
  }

  readonly defaultColumnName = this.options?.defaultColumnName || this.name;
  readonly isNotNullable = this.options?.isNotNullable;
  readonly defaultSqlExpr = this.options?.defaultSqlExpr;

  readonly qName: SQLa.PostgreSqlDomainQualifiedName = this.schema
    .qualifiedReference(this.name);

  readonly castSql = (
    expr: SQLa.PostgreSqlDomainCastExpr,
  ): SQLa.PostgreSqlDomainCastExpr => {
    return `(${expr})::${this.qName}`;
  };

  readonly createSql: SQLa.PostgreSqlStatementSupplier = (state) => {
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

  readonly tableColumn: SQLa.TypedSqlTableColumnSupplier =
    this.options?.tableColumn ||
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
  constructor(
    readonly ag: SQLa.SqlAffinityGroup,
    readonly name: string,
  ) {
  }

  readonly qName = this.ag.qualifiedReference(this.name);
  readonly bodyBlockName = `${this.qName.replaceAll(/\./g, "_")}_body`;
}
