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

export class TypicalSchemaFunctions
  implements iSQL.PostgreSqlLifecycleFunctions {
  constructor(
    readonly ag: iSQL.SqlAffinityGroup,
  ) {
  }

  readonly construct: iSQL.PostgreSqlSchemaFunctionNameSupplier = (
    _,
    override?,
  ) => {
    return lifecycle.qualifiedReference(
      `dcp_lc_${override || this.ag.name}_construct`,
    );
  };

  readonly destroy: iSQL.PostgreSqlSchemaFunctionNameSupplier = (
    _,
    override?,
  ) => {
    return lifecycle.qualifiedReference(
      `dcp_lc_${override || this.ag.name}_destroy`,
    );
  };

  readonly unitTest: iSQL.PostgreSqlSchemaFunctionNameSupplier = (
    _,
    override?,
  ) => {
    return assurance.qualifiedReference(`test_${override || this.ag.name}`);
  };

  readonly populateSecrets: iSQL.PostgreSqlSchemaFunctionNameSupplier = (
    _,
    override?,
  ) => {
    return lifecycle.qualifiedReference(
      `dcp_lc_${override || this.ag.name}_populate_secrets`,
    );
  };

  readonly populateSeedData: iSQL.PostgreSqlSchemaFunctionNameSupplier = (
    _,
    override?,
  ) => {
    return lifecycle.qualifiedReference(
      `dcp_lc_${override || this.ag.name}_populate_seed_data`,
    );
  };

  readonly populateExperimentalData: iSQL.PostgreSqlSchemaFunctionNameSupplier =
    (
      _,
      override?,
    ) => {
      return lifecycle.qualifiedReference(
        `dcp_lc_${override || this.ag.name}_populate_experimental_data`,
      );
    };
}

export class TypicalAffinityGroup implements iSQL.SqlAffinityGroup {
  readonly lcFunctions: iSQL.PostgreSqlLifecycleFunctions;

  constructor(
    readonly name: iSQL.PostgreSqlSchemaName,
  ) {
    this.lcFunctions = new TypicalSchemaFunctions(this);
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
    this.lcFunctions = new TypicalSchemaFunctions(this);
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

  typicalExtension(
    name: iSQL.PostgreSqlExtensionName,
  ): iSQL.PostgreSqlSchemaExtension {
    return new TypicalSchemaExtension(name, this);
  }
}

export class PublicSchema extends TypicalSchema {
  ltreeExtn: iSQL.PostgreSqlSchemaExtension;

  constructor() {
    super("public");
    this.ltreeExtn = this.typicalExtension("ltree");
  }
}

export const publicSchema = new PublicSchema();
export const lifecycle = new TypicalSchema("dcp_lifecycle");
export const assurance = new TypicalSchema("dcp_assurance_engineering");
export const experimental = new TypicalSchema("dcp_experimental");
export const lib = new TypicalSchema("dcp_lib");

export const stateless = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `dcp_stateless${enhancing ? "_enhance" : ""}_${name}`,
  );
};

export const stateful = (name: string, enhancing?: boolean) => {
  return new TypicalSchema(
    `dcp_stateful_${enhancing ? "_enhance" : ""}_${name}`,
  );
};
