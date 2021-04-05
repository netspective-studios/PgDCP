import * as iSQL from "./interpolate-sql.ts";

export class TypicalSchemaExtension implements iSQL.PostgreSqlExtension {
  constructor(
    readonly name: iSQL.PostgreSqlExtensionName,
    readonly schema: iSQL.PostgreSqlSchema,
  ) {
  }

  readonly createSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `CREATE EXTENSION IF NOT EXISTS ${this.name} SCHEMA ${this.schema.name}`;
  };

  readonly dropSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `DROP EXTENSION IF EXISTS ${this.name}`;
  };

  readonly searchPath = [this.schema];
}

export function tableColumnName(
  name: iSQL.SqlTableColumnNameFlexible,
  suggestion?: iSQL.SqlTableColumnName,
): iSQL.SqlTableColumnName {
  return typeof name === "string" ? name : name(suggestion);
}

export class TypicalTableColumnInstance implements iSQL.SqlTableColumn {
  constructor(
    readonly schema: iSQL.PostgreSqlSchema,
    readonly table: iSQL.SqlTable,
    readonly name: iSQL.SqlTableColumnNameFlexible,
    readonly dataType: iSQL.PostgreSqlDomainDataType,
    readonly options?: iSQL.SqlTableColumnOptions,
  ) {
  }

  readonly isNotNullable = this.options?.isNotNullable;
  readonly isPrimaryKey = this.options?.isPrimaryKey;
  readonly foreignKeyDecl = this.options?.foreignKeyDecl;
  readonly foreignKey = this.options?.foreignKey;
  readonly defaultSqlExpr = this.options?.defaultSqlExpr;
  readonly tableConstraintsSql = this.options?.tableConstraintsSql;
  readonly tableIndexesSql = this.options?.tableIndexesSql;

  readonly tableQualifiedName: iSQL.SqlTableColumnQualifiedName = this.table
    .qualifiedReference(tableColumnName(this.name));

  readonly schemaQualifiedName: iSQL.SqlTableColumnQualifiedName = this.schema
    .qualifiedReference(this.table
      .qualifiedReference(tableColumnName(this.name)));

  readonly tableColumnDeclSql: iSQL.PostgreSqlStatementSupplier = () => {
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
}

export interface TableColumnsSupplier {
  (state: iSQL.DcpTemplateState, table: iSQL.SqlTable): TypicalTableColumns;
}

export interface TypicalTableColumns {
  readonly all: iSQL.SqlTableColumn[];
  readonly unique?: {
    name: iSQL.SqlTableConstraintName;
    columns: iSQL.SqlTableColumn[];
  }[];
}

export interface SqlTableCreationComponents {
  readonly columns: iSQL.SqlTableColumn[];
  readonly constraints?: iSQL.PostgreSqlStatement[];
  readonly appendix?: iSQL.PostgreSqlStatement[];
}

export abstract class TypicalTable implements iSQL.SqlTable {
  constructor(
    readonly state: iSQL.DcpTemplateState,
    readonly name: iSQL.SqlTableName,
  ) {
  }

  qName: iSQL.PostgreSqlDomainQualifiedName = this.state.schema
    .qualifiedReference(this.name);

  qualifiedReference(qualify: string) {
    return `${this.name}.${qualify}`;
  }

  abstract get columns(): TypicalTableColumns;

  prepareCreateComponents(
    state: iSQL.DcpTemplateState,
  ): SqlTableCreationComponents {
    const columns = this.columns;
    const constraints: iSQL.PostgreSqlStatement[] = [];
    const appendix: iSQL.PostgreSqlStatement[] = [];

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

  createSql(state: iSQL.DcpTemplateState): iSQL.PostgreSqlStatement {
    const components = this.prepareCreateComponents(state);
    const columns = this.columns;
    const sqlRemarks = (c: iSQL.SqlTableColumn) => {
      const domainReminders = [];
      if (iSQL.isTypedSqlTableColumn(c)) {
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

  readonly dropSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `DROP TABLE IF EXISTS ${this.qName}`;
  };
}

export class TypicalTypedTableColumnInstance extends TypicalTableColumnInstance
  implements iSQL.TypedSqlTableColumn {
  constructor(
    readonly schema: iSQL.PostgreSqlSchema,
    readonly table: iSQL.SqlTable,
    readonly name: iSQL.SqlTableColumnNameFlexible,
    readonly domain: iSQL.PostgreSqlDomain,
    readonly options?: iSQL.SqlTableColumnOptions,
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
}

export class TypicalDomain implements iSQL.PostgreSqlDomain {
  constructor(
    readonly schema: iSQL.PostgreSqlSchema,
    readonly name: iSQL.PostgreSqlDomainName,
    readonly dataType: iSQL.PostgreSqlDomainDataType,
    readonly options?: iSQL.PostgreSqlDomainColumnOptions & {
      readonly defaultColumnName?: iSQL.SqlTableColumnNameFlexible;
      readonly tableColumn?: iSQL.TypedSqlTableColumnSupplier;
      readonly overrideTableColOptions?: (
        options?: iSQL.SqlTableColumnOptions,
      ) => iSQL.SqlTableColumnOptions | undefined;
    },
  ) {
  }

  readonly defaultColumnName = this.options?.defaultColumnName || this.name;
  readonly isNotNullable = this.options?.isNotNullable;
  readonly defaultSqlExpr = this.options?.defaultSqlExpr;

  readonly qName: iSQL.PostgreSqlDomainQualifiedName = this.schema
    .qualifiedReference(this.name);

  readonly createSql: iSQL.PostgreSqlStatementSupplier = (state) => {
    const options: string[] = [];
    if (this.isNotNullable) options.push("NOT NULL");
    if (this.defaultSqlExpr) {
      options.push(`default ${this.defaultSqlExpr}`);
    }
    // deno-fmt-ignore
    return `BEGIN CREATE DOMAIN ${this.schema.qualifiedReference(this.name)} AS ${this.dataType}${options.length > 0 ? ` ${options.join(" ")}` : ""}; EXCEPTION WHEN duplicate_object THEN null; END`
  };

  readonly dropSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `DROP DOMAIN IF EXISTS ${this.schema.qualifiedReference(this.name)}`;
  };

  readonly tableColumn: iSQL.TypedSqlTableColumnSupplier =
    this.options?.tableColumn || ((
      table: iSQL.SqlTable,
      options?: iSQL.SqlTableColumnOptions,
    ): iSQL.TypedSqlTableColumn => {
      return new TypicalTypedTableColumnInstance(
        this.schema,
        table,
        this.defaultColumnName,
        this,
        this.options?.overrideTableColOptions
          ? this.options?.overrideTableColOptions(options)
          : options,
      );
    });
}

export class TypicalDomainReference implements iSQL.PostgreSqlDomainReference {
  constructor(
    readonly schema: iSQL.PostgreSqlSchema,
    readonly prime: iSQL.PostgreSqlDomain,
  ) {
  }

  get reference(): iSQL.PostgreSqlDomain {
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
  implements iSQL.PostgreSqlStoredRoutine {
  constructor(
    readonly ag: iSQL.SqlAffinityGroup,
    readonly name: string,
  ) {
  }

  readonly qName = this.ag.qualifiedReference(this.name);
}

export class TypicalSqlLifecycleFunctions
  implements iSQL.PostgreSqlLifecycleFunctions {
  constructor(
    readonly ag: iSQL.SqlAffinityGroup,
  ) {
  }

  readonly constructStorage: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_construct_storage`,
    );
  };

  readonly constructDomains: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_construct_domains`,
    );
  };

  readonly constructIdempotent: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_construct_idempotent`,
    );
  };

  readonly destroyStorage: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_destroy_storage`,
    );
  };

  readonly destroyIdempotent: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_destroy_idempotent`,
    );
  };

  readonly deployProvenanceHttpRequest: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `${override || this.ag.name}_deploy_provenance_http_request`,
    );
  };

  readonly upgrade: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `${override || this.ag.name}_upgrade`,
    );
  };

  readonly unitTest: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `test_${override || this.ag.name}`,
    );
  };

  readonly lint: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `lint_${override || this.ag.name}`,
    );
  };

  readonly doctor: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `test_doctor_${override || this.ag.name}`,
    );
  };

  readonly metrics: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `observability_metrics_${override || this.ag.name}`,
    );
  };

  readonly populateSecrets: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_populate_secrets`,
    );
  };

  readonly populateSeedData: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.name}_populate_seed_data`,
    );
  };

  readonly populateExperimentalData: iSQL.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new TypicalPostgreSqlSchemaStoredRoutine(
      experimental,
      `${override || this.ag.name}_populate_experimental_data`,
    );
  };
}

export class TypicalAffinityGroup implements iSQL.SqlAffinityGroup {
  readonly lcFunctions: iSQL.PostgreSqlLifecycleFunctions;

  constructor(
    readonly name: iSQL.PostgreSqlSchemaName,
  ) {
    this.lcFunctions = new TypicalSqlLifecycleFunctions(this);
  }

  readonly qualifiedReference = (qualify: string) => {
    return `${this.name}_${qualify}`;
  };

  readonly setSearchPathSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `SET search_path TO 'TypicalAffinityGroup.TODO'`;
  };
}

export class TypicalSchema implements iSQL.PostgreSqlSchema {
  readonly lcFunctions: iSQL.PostgreSqlLifecycleFunctions;
  readonly #domainsCreated = new Map<
    iSQL.PostgreSqlDomainName,
    iSQL.PostgreSqlDomain
  >();

  constructor(
    readonly name: iSQL.PostgreSqlSchemaName,
  ) {
    this.lcFunctions = new TypicalSqlLifecycleFunctions(this);
  }

  readonly qualifiedReference = (qualify: string) => {
    return `${this.name}.${qualify}`;
  };

  readonly createSchemaSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `CREATE SCHEMA IF NOT EXISTS ${this.name}`;
  };

  readonly dropSchemaSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `DROP SCHEMA IF EXISTS ${this.name} CASCADE`;
  };

  readonly setSearchPathSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `SET search_path TO 'TypicalSchema.TODO'`;
  };

  readonly extension = (
    name: iSQL.PostgreSqlExtensionName,
  ): iSQL.PostgreSqlExtension => {
    return new TypicalSchemaExtension(name, this);
  };

  get domainsUsed(): iSQL.PostgreSqlDomain[] {
    const used: iSQL.PostgreSqlDomain[] = [];
    for (const d of this.#domainsCreated.values()) {
      used.push(d);
    }
    return used;
  }

  readonly useDomain = (
    name: iSQL.PostgreSqlDomainName,
    onCreate: (
      name: iSQL.PostgreSqlDomainName,
      schema: iSQL.PostgreSqlSchema,
    ) => iSQL.PostgreSqlDomain,
  ): iSQL.PostgreSqlDomain => {
    let domain = this.#domainsCreated.get(name);
    if (!domain) {
      domain = onCreate(name, this);
      this.#domainsCreated.set(name, domain);
    }
    return domain;
  };
}

export class ExtensionsSchema extends TypicalSchema {
  readonly pgTapExtn: iSQL.PostgreSqlExtension;
  readonly pgStatStatementsExtn: iSQL.PostgreSqlExtension;
  readonly pgCryptoExtn: iSQL.PostgreSqlExtension;
  readonly unaccentExtn: iSQL.PostgreSqlExtension;
  readonly ltreeExtn: iSQL.PostgreSqlExtension;
  readonly semverExtn: iSQL.PostgreSqlExtension;
  readonly crossTabExtn: iSQL.PostgreSqlExtension;
  readonly pgCronExtn: iSQL.PostgreSqlExtension;
  readonly uuidExtn: iSQL.PostgreSqlExtension;
  readonly httpExtn: iSQL.PostgreSqlExtension;
  readonly postgresFDW: iSQL.PostgreSqlExtension;

  constructor() {
    super("dcp_extensions");
    this.pgTapExtn = this.extension("pgtap");
    this.pgStatStatementsExtn = this.extension("pg_stat_statements");
    this.unaccentExtn = this.extension("unaccent");
    this.ltreeExtn = this.extension("ltree");
    this.semverExtn = this.extension("semver");
    this.crossTabExtn = this.extension("tablefunc");
    this.pgCronExtn = this.extension("pg_cron");
    this.pgCryptoExtn = this.extension("pgcrypto");
    this.uuidExtn = this.extension('"uuid-ossp"');
    this.httpExtn = this.extension("http");
    this.postgresFDW = this.extension("postgres_fdw");
  }
}

export class PgCatalogSchema extends TypicalSchema {
  // extension "plpython3u" must be installed in schema "pg_catalog"
  // "pg_catalog" is implictly included in every search_path, though
  readonly plPythonExtn: iSQL.PostgreSqlExtension;

  constructor() {
    super("pg_catalog");
    this.plPythonExtn = this.extension("plpython3u");
  }
}

export const extensions = new ExtensionsSchema();
export const pgCatalog = new PgCatalogSchema();
export const lifecycle = new TypicalSchema("dcp_lifecycle");
export const assurance = new TypicalSchema("dcp_assurance_engineering");
export const experimental = new TypicalSchema("dcp_experimental");
export const lib = new TypicalSchema("dcp_lib");
export const confidential = new TypicalSchema("dcp_confidential");
export const cron = new TypicalSchema("cron");

export const stateless = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `stateless${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const statelessFDW = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `fdw_stateless${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const stateful = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `stateful${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const statefulUnrecoverable = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `stateful_unrecoverable${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const statefulFDW = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `fdw_stateful${enhancing ? "_enhance" : ""}_${name}`,
  );
};
