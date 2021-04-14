import * as SQLa from "../sqla.ts";
import * as SQLaT from "./sqla-typical.ts";

export class TypicalSqlLifecycleFunctions
  implements SQLa.PostgreSqlLifecycleFunctions {
  constructor(
    readonly ag: SQLa.SqlAffinityGroup,
  ) {
  }

  readonly constructStorage: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_construct_storage`,
    );
  };

  readonly constructDomains: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_construct_domains`,
    );
  };

  readonly constructIdempotent: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_construct_idempotent`,
    );
  };

  readonly destroyStorage: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_destroy_storage`,
    );
  };

  readonly destroyIdempotent: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_destroy_idempotent`,
    );
  };

  readonly deployProvenanceHttpRequest: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_deploy_provenance_http_request`,
    );
  };

  readonly upgrade: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_upgrade`,
    );
  };

  readonly unitTest: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `test_${override || this.ag.qName}`,
    );
  };

  readonly lint: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `lint_${override || this.ag.qName}`,
    );
  };

  readonly doctor: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      assurance,
      `test_doctor_${override || this.ag.qName}`,
    );
  };

  readonly metrics: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `observability_metrics_${override || this.ag.qName}`,
    );
  };

  readonly populateContext: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_populate_experimental_data`,
    );
  };

  readonly populateSecrets: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_populate_secrets`,
    );
  };

  readonly populateSeedData: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_populate_seed_data`,
    );
  };

  readonly populateData: SQLa.PostgreSqlStoredRoutineSupplier = (
    _,
    override?,
  ) => {
    return new SQLaT.TypicalPostgreSqlSchemaStoredRoutine(
      lifecycle,
      `${override || this.ag.qName}_populate_data`,
    );
  };
}

export class TypicalAffinityGroup implements SQLa.SqlAffinityGroup {
  readonly lcFunctions: SQLa.PostgreSqlLifecycleFunctions;
  readonly qName: SQLa.SqlAffinityAncestorizedGroupName;

  constructor(
    readonly name: SQLa.PostgreSqlSchemaName,
    readonly parent?: SQLa.SqlAffinityGroup,
  ) {
    this.lcFunctions = new TypicalSqlLifecycleFunctions(this);
    this.qName = this.parent ? `${this.parent.qName}_${this.name}` : this.name;
  }

  readonly qualifiedReference = (qualify: string) => {
    return `${this.qName}_${qualify}`;
  };

  readonly setSearchPathSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `SET search_path TO 'TypicalAffinityGroup.TODO'`;
  };
}

export class TypicalSchema implements SQLa.PostgreSqlSchema {
  readonly lcFunctions: SQLa.PostgreSqlLifecycleFunctions;
  readonly qName: SQLa.SqlAffinityAncestorizedGroupName;
  readonly #domainsCreated = new Map<
    SQLa.PostgreSqlDomainName,
    SQLa.PostgreSqlDomain
  >();

  constructor(
    readonly name: SQLa.PostgreSqlSchemaName,
  ) {
    this.lcFunctions = new TypicalSqlLifecycleFunctions(this);
    // schemas, unlike affinity groups, do not have ancestors
    this.qName = this.name;
  }

  readonly qualifiedReference = (qualify: string) => {
    return `${this.name}.${qualify}`;
  };

  readonly createSchemaSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `CREATE SCHEMA IF NOT EXISTS ${this.name}`;
  };

  readonly dropSchemaSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `DROP SCHEMA IF EXISTS ${this.name} CASCADE`;
  };

  readonly setSearchPathSql: SQLa.PostgreSqlStatementSupplier = () => {
    return `SET search_path TO 'TypicalSchema.TODO'`;
  };

  readonly extension = (
    name: SQLa.PostgreSqlExtensionName,
  ): SQLa.PostgreSqlExtension => {
    return new SQLaT.TypicalSchemaExtension(name, this);
  };

  get domainsUsed(): SQLa.PostgreSqlDomain[] {
    const used: SQLa.PostgreSqlDomain[] = [];
    for (const d of this.#domainsCreated.values()) {
      used.push(d);
    }
    return used;
  }

  readonly useDomain = (
    name: SQLa.PostgreSqlDomainName,
    onCreate: (
      name: SQLa.PostgreSqlDomainName,
      schema: SQLa.PostgreSqlSchema,
    ) => SQLa.PostgreSqlDomain,
  ): SQLa.PostgreSqlDomain => {
    let domain = this.#domainsCreated.get(name);
    if (!domain) {
      domain = onCreate(name, this);
      this.#domainsCreated.set(name, domain);
    }
    return domain;
  };
}

export class ExtensionsSchema extends TypicalSchema {
  readonly pgTapExtn: SQLa.PostgreSqlExtension;
  readonly pgStatStatementsExtn: SQLa.PostgreSqlExtension;
  readonly pgCryptoExtn: SQLa.PostgreSqlExtension;
  readonly unaccentExtn: SQLa.PostgreSqlExtension;
  readonly ltreeExtn: SQLa.PostgreSqlExtension;
  readonly semverExtn: SQLa.PostgreSqlExtension;
  readonly crossTabExtn: SQLa.PostgreSqlExtension;
  readonly pgCronExtn: SQLa.PostgreSqlExtension;
  readonly uuidExtn: SQLa.PostgreSqlExtension;
  readonly httpExtn: SQLa.PostgreSqlExtension;
  readonly postgresFDW: SQLa.PostgreSqlExtension;
  readonly isjsonbValid: SQLa.PostgreSqlExtension;

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
    this.isjsonbValid = this.extension("is_jsonb_valid");
  }
}

export class PgCatalogSchema extends TypicalSchema {
  // extension "plpython3u" must be installed in schema "pg_catalog"
  // "pg_catalog" is implictly included in every search_path, though
  readonly plPythonExtn: SQLa.PostgreSqlExtension;

  constructor() {
    super("pg_catalog");
    this.plPythonExtn = this.extension("plpython3u");
  }
}

export const lifecycle = new TypicalSchema("dcp_lifecycle");
export const assurance = new TypicalSchema("dcp_assurance_engineering");
export const extensions = new ExtensionsSchema();
export const pgCatalog = new PgCatalogSchema();
export const experimental = new TypicalSchema("dcp_experimental");
export const context = new TypicalSchema(
  "dcp_context",
);
export const lib = new TypicalSchema("dcp_lib");
export const confidential = new TypicalSchema("dcp_confidential");
export const cron = new TypicalSchema("cron");

export const stateless = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(`stateless${enhancing ? "_enhance" : ""}_${name}`);
};

export const statelessFDW = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `fdw_stateless${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const stateful = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(`stateful${enhancing ? "_enhance" : ""}_${name}`);
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
