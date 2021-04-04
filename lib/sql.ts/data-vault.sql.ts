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

export class DataVaultIdentity extends mod.schemas.TypicalDomain {
  constructor(
    readonly schema: mod.PostgreSqlSchema,
    readonly name: mod.PostgreSqlDomainName,
  ) {
    super(schema, name, "UUID", {
      isNotNullable: true,
      defaultSqlExpr: "gen_random_uuid()",
    });
  }

  readonly tableColumn: mod.TypedSqlTableColumnSupplier = (
    table,
    columnName,
    options?,
  ): mod.TypedSqlTableColumn => {
    const column: mod.TypedSqlTableColumn = new mod.schemas
      .TypicalTypedTableColumnInstance(
      this.schema,
      table,
      columnName,
      this,
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
  };
}

export type HubName = string;
export type LinkName = string;
export type SatelliteName = string;

export function hubIdDomain(name: HubName): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`hub_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name);
    });
  };
}

export function linkIdDomain(name: LinkName): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`link_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name);
    });
  };
}

export function satelliteIdDomain(
  name: SatelliteName,
): mod.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`sat_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name);
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
    readonly hubName: HubName,
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
    super(state, `hub_${hubName}`);
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new mod.schemas.TypicalDomainReference(state.schema, domain);
    });
    this.hubIdDomain = options?.hubIdDomain ||
      hubIdDomain(hubName)(state);
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

export class LinkTable extends mod.schemas.TypicalTable {
  readonly linkIdDomain: mod.PostgreSqlDomain;
  readonly linkId: mod.TypedSqlTableColumn;
  readonly linkIdRefDomain: mod.PostgreSqlDomainReference;
  readonly hubColumns: mod.TypedSqlTableColumn[];
  readonly provDomain: mod.PostgreSqlDomain;
  readonly domainRefSupplier: mod.PostgreSqlDomainReferenceSupplier;
  readonly columns: mod.schemas.TypicalTableColumns;

  constructor(
    readonly state: mod.DcpTemplateState,
    readonly linkName: LinkName,
    readonly hubs: HubTable[],
    options?: {
      hubIdDomain?: mod.PostgreSqlDomain;
      provDomain?: mod.PostgreSqlDomain;
      domainRefSupplier?: mod.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, `link_${linkName}`);
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new mod.schemas.TypicalDomainReference(state.schema, domain);
    });
    this.linkIdDomain = options?.hubIdDomain ||
      linkIdDomain(linkName)(state);
    this.linkIdRefDomain = this.domainRefSupplier(
      this.linkIdDomain,
      state,
    );
    state.schema.useDomain(this.linkIdRefDomain.reference.name, () => {
      return this.linkIdRefDomain.reference;
    });
    this.provDomain = options?.provDomain || provenanceUriDomain(state);

    this.linkId = this.linkIdDomain.tableColumn(this, "link_id");
    this.hubColumns = [];
    for (const hub of this.hubs) {
      const domain = hub.hubIdRefDomain;
      this.hubColumns.push(domain.reference.tableColumn(this, hub.name, {
        isNotNullable: true,
        foreignKey: { table: hub, column: hub.hubId },
      }));
    }

    this.columns = {
      all: [
        this.linkId,
        ...this.hubColumns,
        creationTimestampDomain(state).tableColumn(this, "created_at"),
        creationUserDomain(state).tableColumn(this, "created_by"),
        this.provDomain.tableColumn(this, "provenance"),
        observabilityColumn(state, this),
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.hubColumns,
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
    readonly satelliteName: SatelliteName,
    readonly organicColumns: (
      table: SatelliteTable,
    ) => mod.schemas.TypicalTableColumns,
    options?: {
      satIdDomain?: mod.PostgreSqlDomain;
      provDomain?: mod.PostgreSqlDomain;
      domainRefSupplier?: mod.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, `sat_${satelliteName}`);
    this.domainRefSupplier = options?.domainRefSupplier ||
      parent.domainRefSupplier;
    this.satIdDomain = options?.satIdDomain ||
      satelliteIdDomain(satelliteName)(state);
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
        foreignKey: { table: this.parent, column: this.parent.hubId },
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

export class ExceptionHub extends HubTable {
  constructor(readonly state: mod.DcpTemplateState) {
    super(state, "exception", [{
      name: "key",
      domain: hubTextBusinessKeyDomain("exception_hub_key"),
    }]);
  }
}

export class ExceptionDiagnostics extends SatelliteTable {
  constructor(
    readonly state: mod.DcpTemplateState,
    readonly parent: ExceptionHub,
  ) {
    super(
      state,
      parent,
      "exception_diagnostics",
      (table) => {
        return {
          all: [
            "message",
            "err_returned_sqlstate",
            "err_pg_exception_detail",
            "err_pg_exception_hint",
            "err_pg_exception_context",
          ].map((name) =>
            new mod.schemas.TypicalTableColumnInstance(
              state.schema,
              table,
              name,
              "text",
            )
          ),
        };
      },
    );
  }
}

export class ExceptionHttpClient extends SatelliteTable {
  constructor(
    readonly state: mod.DcpTemplateState,
    readonly parent: ExceptionHub,
  ) {
    super(
      state,
      parent,
      "exception_http_client",
      (table) => {
        return {
          all: ["http_req", "http_resp"].map((name) =>
            new mod.schemas.TypicalTableColumnInstance(
              state.schema,
              table,
              name,
              "jsonb",
            )
          ),
        };
      },
    );
  }
}

export function SQL(
  ctx: mod.DcpInterpolationContext,
  schema: mod.PostgreSqlSchema,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    {
      schema,
      extensions: [
        mod.schemas.extensions.ltreeExtn,
        mod.schemas.extensions.httpExtn,
      ],
    },
  );
  const { qualifiedReference: sqr } = state.schema;
  const { lcFunctions: lcf } = state.schema;
  const exceptionHub = new ExceptionHub(state);
  const exceptionDiags = new ExceptionDiagnostics(state, exceptionHub);
  const exceptionHttpClient = new ExceptionHttpClient(state, exceptionHub);

  // deno-fmt-ignore
  return mod.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      call ${lcf.constructDomains(state).qName}();

      ${exceptionHub.createSql(state)}

      ${exceptionDiags.createSql(state)}

      ${exceptionHttpClient.createSql(state)}
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
