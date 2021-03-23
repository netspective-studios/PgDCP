import * as iSQL from "./interpolate-sql.ts";

export class TypicalSchemaExtension implements iSQL.PostgreSqlSchemaExtension {
  constructor(
    readonly name: iSQL.PostgreSqlExtensionName,
    readonly schema: iSQL.PostgreSqlSchema,
  ) {
  }

  readonly createSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `CREATE EXTENSION IF NOT EXISTS ${this.name}`;
  };

  readonly dropSql: iSQL.PostgreSqlStatementSupplier = () => {
    return `DROP EXTENSION IF EXISTS ${this.name}`;
  };

  readonly searchPath = [this.schema.name];
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
  ): iSQL.PostgreSqlSchemaExtension => {
    return new TypicalSchemaExtension(name, this);
  };
}

export class PublicSchema extends TypicalSchema {
  ltreeExtn: iSQL.PostgreSqlSchemaExtension;

  constructor() {
    super("public");
    this.ltreeExtn = this.extension("ltree");
  }
}

export const publicSchema = new PublicSchema();
export const lifecycle = new TypicalSchema("dcp_lifecycle");
export const assurance = new TypicalSchema("dcp_assurance_engineering");
export const experimental = new TypicalSchema("dcp_experimental");
export const lib = new TypicalSchema("dcp_lib");

export const stateless = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `stateless${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const stateful = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `stateful${enhancing ? "_enhance" : ""}_${name}`,
  );
};