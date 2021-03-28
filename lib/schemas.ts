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
