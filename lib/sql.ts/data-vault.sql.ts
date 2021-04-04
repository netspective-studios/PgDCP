import * as mod from "../mod.ts";

export const spanIdDomain: mod.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("span_id", (name, schema) => {
    return new mod.schemas.TypicalDomain(schema, name, "text", {
      isNotNullable: true,
    });
  });
};

export function observabilityColumn(
  state: mod.DcpTemplateState,
  table: mod.SqlTable,
): mod.SqlTableColumn {
  return new mod.schemas.TypicalTableColumnInstance(
    state.schema,
    table,
    "observability",
    "jsonb",
  );
}

export const creationTimestampDomain: mod.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("creation_timestamp", (name, schema) => {
    return new mod.schemas.TypicalDomain(schema, name, "timestamptz", {
      defaultSqlExpr: "current_timestamp",
    });
  });
};

export const creationUserDomain: mod.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("creation_user_name", (name, schema) => {
    return new mod.schemas.TypicalDomain(schema, name, "name", {
      defaultSqlExpr: "current_user",
    });
  });
};

export const provenanceUriDomain: mod.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("provenance_uri", (name, schema) => {
    return new mod.schemas.TypicalDomain(schema, name, "text", {
      defaultSqlExpr: "'system://'",
    });
  });
};

export type HubName = string;
export type SatelliteName = string;

export function hubIdDomain(name: HubName): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`hub_${name}_id`, (name, schema) => {
      const domain: mod.PostgreSqlDomain = new mod.schemas.TypicalDomain(
        schema,
        name,
        "UUID",
        {
          isNotNullable: true,
          defaultSqlExpr: "gen_random_uuid()",
          tableColumn: (table, columnName, options) => {
            const column: mod.TypedSqlTableColumn = new mod.schemas
              .TypicalTypedTableColumnInstance(
              schema,
              table,
              columnName,
              domain,
              {
                ...options, // TODO: properly merge in the items below, not just override them
                tableConstraintsSql: (state) =>
                  `CONSTRAINT ${table.name}_pk UNIQUE(${column.name})`,
                tableIndexesSql: () =>
                  `CREATE INDEX ${table.name}_${column.name}_idx ON ${table.qName} (${column.name})`,
                isPrimaryKey: true,
              },
            );
            return column;
          },
        },
      );
      return domain;
    });
  };
}

export function satelliteIdDomain(
  name: SatelliteName,
): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`sat_${name}_id`, (name, schema) => {
      const domain: mod.PostgreSqlDomain = new mod.schemas.TypicalDomain(
        schema,
        name,
        "UUID",
        {
          isNotNullable: true,
          defaultSqlExpr: "gen_random_uuid()",
          tableColumn: (table, columnName, options) => {
            const column: mod.TypedSqlTableColumn = new mod.schemas
              .TypicalTypedTableColumnInstance(
              schema,
              table,
              columnName,
              domain,
              {
                ...options, // TODO: properly merge in the items below, not just override them
                tableConstraintsSql: (state) =>
                  `CONSTRAINT ${table.name}_pk UNIQUE(${column.name})`,
                tableIndexesSql: () =>
                  `CREATE INDEX ${table.name}_${column.name}_idx ON ${table.qName} (${column.name})`,
                isPrimaryKey: true,
              },
            );
            return column;
          },
        },
      );
      return domain;
    });
  };
}

export function hubTextBusinessKeyDomain(
  name: mod.PostgreSqlDomainName,
): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new mod.schemas.TypicalDomain(schema, name, "text", {
        isNotNullable: true,
      });
    });
  };
}

export class HubTable extends mod.schemas.TypicalTable {
  readonly hubIdDomain: mod.PostgreSqlDomain;
  readonly hubId: mod.TypedSqlTableColumn;
  readonly hubIdRefDomain: mod.PostgreSqlDomainReference;
  readonly keyColumns: mod.TypedSqlTableColumn[];
  readonly provDomain: mod.PostgreSqlDomain;
  readonly domainRefSupplier: mod.PostgreSqlDomainReferenceSupplier;
  readonly columns: mod.schemas.TypicalTableColumns;

  constructor(
    readonly state: mod.DcpTemplateState,
    readonly name: mod.SqlTableName,
    readonly keys: {
      name: mod.SqlTableColumnName;
      domain: mod.PostgreSqlDomainSupplier;
    }[],
    options?: {
      hubIdDomain?: mod.PostgreSqlDomain;
      provDomain?: mod.PostgreSqlDomain;
      domainRefSupplier?: mod.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, name);
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new mod.schemas.TypicalDomainReference(state.schema, domain);
    });
    this.hubIdDomain = options?.hubIdDomain ||
      hubIdDomain(name)(state);
    this.hubIdRefDomain = this.domainRefSupplier(
      this.hubIdDomain,
      state,
    );
    state.schema.useDomain(this.hubIdRefDomain.reference.name, () => {
      return this.hubIdRefDomain.reference;
    });
    this.provDomain = options?.provDomain || provenanceUriDomain(state);

    this.hubId = this.hubIdDomain.tableColumn(this, "hub_id");
    this.keyColumns = [];
    for (const key of this.keys) {
      const domain = key.domain(state);
      this.keyColumns.push(domain.tableColumn(this, key.name));
    }

    this.columns = {
      all: [
        this.hubId,
        ...this.keyColumns,
        creationTimestampDomain(state).tableColumn(this, "created_at"),
        creationUserDomain(state).tableColumn(this, "created_by"),
        this.provDomain.tableColumn(this, "provenance"),
        observabilityColumn(state, this),
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.keyColumns,
      }],
    };
  }
}

export class SatelliteTable extends mod.schemas.TypicalTable {
  readonly satIdDomain: mod.PostgreSqlDomain;
  readonly satId: mod.TypedSqlTableColumn;
  readonly hubId: mod.TypedSqlTableColumn;
  readonly satIdRefDomain: mod.PostgreSqlDomainReference;
  readonly provDomain: mod.PostgreSqlDomain;
  readonly domainRefSupplier: mod.PostgreSqlDomainReferenceSupplier;
  readonly columns: mod.schemas.TypicalTableColumns;

  constructor(
    readonly state: mod.DcpTemplateState,
    readonly parent: HubTable,
    readonly name: mod.SqlTableName,
    readonly organicColumns: (
      table: SatelliteTable,
    ) => mod.schemas.TypicalTableColumns,
    options?: {
      satIdDomain?: mod.PostgreSqlDomain;
      provDomain?: mod.PostgreSqlDomain;
      domainRefSupplier?: mod.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, name);
    this.domainRefSupplier = options?.domainRefSupplier ||
      parent.domainRefSupplier;
    this.satIdDomain = options?.satIdDomain ||
      satelliteIdDomain(name)(state);
    this.satIdRefDomain = this.domainRefSupplier(
      this.satIdDomain,
      state,
    );
    state.schema.useDomain(this.satIdRefDomain.reference.name, () => {
      return this.satIdRefDomain.reference;
    });
    this.provDomain = options?.provDomain || parent.provDomain;

    this.satId = this.satIdDomain.tableColumn(this, "sat_id");
    this.hubId = this.parent.hubIdRefDomain.reference.tableColumn(
      this,
      "hub_id",
      {
        isNotNullable: true,
        foreignKeyDecl:
          `REFERENCES ${this.parent.qName}(${this.parent.hubId.name})`,
      },
    );
    const attributes = organicColumns(this);
    this.columns = {
      all: [
        this.satId,
        this.hubId,
        ...attributes.all,
        creationTimestampDomain(state).tableColumn(this, "created_at"),
        creationUserDomain(state).tableColumn(this, "created_by"),
        this.provDomain.tableColumn(this, "provenance"),
        observabilityColumn(state, this),
      ],
      unique: attributes.unique,
    };
  }
}

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: mod.schemas.lib,
      extensions: [
        mod.schemas.extensions.ltreeExtn,
        mod.schemas.extensions.httpExtn,
      ],
    },
  );
  const { qualifiedReference: sqr } = state.schema;
  const { lcFunctions: lcf } = state.schema;
  const exceptionHubTable = new HubTable(state, "exception", [{
    name: "key",
    domain: hubTextBusinessKeyDomain("exception_hub_key"),
  }]);
  const exceptionDiagsSatTable = new SatelliteTable(
    state,
    exceptionHubTable,
    "exception_diagnostics",
    () => {
      return {
        all: [],
      };
    },
  );

  // deno-fmt-ignore
  return mod.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      call ${lcf.constructDomains(state).qName}();
      ${exceptionHubTable.createSql(state)}
      ${exceptionDiagsSatTable.createSql(state)}

      CREATE DOMAIN ${sqr("hub_exception_id")} AS UUID NOT NULL DEFAULT gen_random_uuid();
      CREATE DOMAIN ${sqr("hub_exception_id_fk")} AS UUID;
      CREATE TABLE ${sqr("hub_exception")}(
        hub_id ${sqr("hub_exception_id")} PRIMARY KEY,
        key ${sqr("dv_span_id")} NOT NULL,
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        provDomain ${sqr("dv_provenance_uri")},
        observability jsonb,
        CONSTRAINT hub_exception_pk UNIQUE(hub_id),
        CONSTRAINT hub_exception_unq UNIQUE(key)
      );
      CREATE INDEX hub_exception_key_idx ON ${sqr("hub_exception")} (key);

      CREATE DOMAIN ${sqr("sat_exception_diagnostics_id")} AS UUID NOT NULL DEFAULT gen_random_uuid();
      CREATE DOMAIN ${sqr("sat_exception_diagnostics_id_fk")} AS UUID;
      CREATE TABLE ${sqr("sat_exception_diagnostics")}(
        sat_id ${sqr("sat_exception_diagnostics_id")} PRIMARY KEY,
        hub_id ${sqr("hub_exception_id_fk")} NOT NULL REFERENCES ${sqr("hub_exception")}(hub_id),
        message text,
        err_returned_sqlstate text,
        err_pg_exception_detail text,
        err_pg_exception_hint text,
        err_pg_exception_context text,
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        provDomain ${sqr("dv_provenance_uri")},
        observability jsonb,
        CONSTRAINT sat_exception_diagnostics_pk UNIQUE(sat_id)
      );
      CREATE INDEX sat_exception_diagnostics_hub_id_idx ON ${sqr("sat_exception_diagnostics")} (hub_id);

      CREATE DOMAIN ${sqr("sat_exception_http_client_id")} AS UUID NOT NULL DEFAULT gen_random_uuid();
      CREATE DOMAIN ${sqr("sat_exception_diagnostics_id_fk")} AS UUID;
      CREATE TABLE ${sqr("sat_exception_http_client")}(
        sat_id ${sqr("sat_exception_http_client_id")} PRIMARY KEY,
        hub_id ${sqr("hub_exception_id_fk")} NOT NULL REFERENCES ${sqr("hub_exception")}(hub_id),
        http_req jsonb,
        http_resp jsonb,
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        provDomain ${sqr("dv_provenance_uri")},
        observability jsonb,
        CONSTRAINT sat_exception_http_client_pk UNIQUE(sat_id)
      );
      CREATE INDEX sat_exception_http_client_hub_id_idx ON ${sqr("sat_exception_http_client")} (hub_id);
    END; $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $innerFn$
    BEGIN
      DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
      DROP PROCEDURE IF EXISTS ${sqr("populate_gitlab_projec_hubs")};
    END; 
    $innerFn$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN
      RETURN NEXT has_function('populate_gitlab_proje_hubts');
    END;
    $$;
`;
}
