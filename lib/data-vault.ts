import * as iSQL from "./interpolate-sql.ts";
import * as schemas from "./schemas.ts";

export const telemetrySpanIdDomain: iSQL.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("telemetry_span_id", (name, schema) => {
    return new schemas.TypicalDomain(schema, name, "text", {
      defaultColumnName: "span_id",
      isNotNullable: true,
    });
  });
};

export const loadedOnTimestampDomain: iSQL.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("loaded_at_timestamp", (name, schema) => {
    return new schemas.TypicalDomain(schema, name, "timestamptz", {
      defaultColumnName: "loaded_at",
      defaultSqlExpr: "current_timestamp",
    });
  });
};

export const loadedByUserDomain: iSQL.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("loaded_by_db_user_name", (name, schema) => {
    return new schemas.TypicalDomain(schema, name, "name", {
      defaultColumnName: "loaded_by",
      defaultSqlExpr: "current_user",
    });
  });
};

export const provenanceUriDomain: iSQL.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("provenance_uri", (name, schema) => {
    return new schemas.TypicalDomain(schema, name, "text", {
      defaultColumnName: "provenance",
      defaultSqlExpr: "'system://'",
    });
  });
};

export const contentHashDomain: iSQL.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("content_hash", (name, schema) => {
    return new schemas.TypicalDomain(schema, name, "text", {
      isNotNullable: true,
    });
  });
};

export class DataVaultIdentity extends schemas.TypicalDomain {
  constructor(
    readonly schema: iSQL.PostgreSqlSchema,
    readonly name: iSQL.PostgreSqlDomainName,
    readonly defaultColumnName: iSQL.SqlTableColumnNameFlexible,
  ) {
    super(schema, name, "UUID", {
      defaultColumnName,
      isNotNullable: true,
      defaultSqlExpr: "gen_random_uuid()",
    });
  }

  readonly tableColumn: iSQL.TypedSqlTableColumnSupplier = (
    table,
    options?,
  ): iSQL.TypedSqlTableColumn => {
    const column: iSQL.TypedSqlTableColumn = new schemas
      .TypicalTypedTableColumnInstance(
      this.schema,
      table,
      this.defaultColumnName,
      this,
      {
        ...options, // TODO: properly merge in the items below, not just override them
        tableConstraintsSql: () =>
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

export function hubIdDomain(name: HubName): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`hub_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "hub_id");
    });
  };
}

export function linkIdDomain(name: LinkName): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`link_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "link_id");
    });
  };
}

export function satelliteIdDomain(
  name: SatelliteName,
): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`sat_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "sat_id");
    });
  };
}

export function hubTextBusinessKeyDomain(
  name: iSQL.PostgreSqlDomainName,
  defaultColumnName: iSQL.SqlTableColumnNameFlexible,
): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new schemas.TypicalDomain(schema, name, "text", {
        defaultColumnName,
        isNotNullable: true,
      });
    });
  };
}

export function hubUriBusinessKeyDomain(
  name: iSQL.PostgreSqlDomainName,
  defaultColumnName: iSQL.SqlTableColumnNameFlexible,
): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new schemas.TypicalDomain(schema, name, "text", {
        defaultColumnName,
        isNotNullable: true,
        // TODO: add a constraint to verify that it's a valid URI
      });
    });
  };
}

export function hubLtreeBusinessKeyDomain(
  name: iSQL.PostgreSqlDomainName,
  defaultColumnName: iSQL.SqlTableColumnNameFlexible,
): iSQL.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new schemas.TypicalDomain(schema, name, "ltree", {
        defaultColumnName,
        isNotNullable: true,
      });
    });
  };
}

/**
 * HubTable automates the creation of Data Vault 2.0 physical Hub tables.
 * 
 * Ref: https://www.sciencedirect.com/topics/computer-science/data-vault-model
 */
export class HubTable extends schemas.TypicalTable {
  readonly hubIdDomain: iSQL.PostgreSqlDomain;
  readonly hubId: iSQL.TypedSqlTableColumn;
  readonly hubIdRefDomain: iSQL.PostgreSqlDomainReference;
  readonly keyColumns: iSQL.TypedSqlTableColumn[];
  readonly provDomain: iSQL.PostgreSqlDomain;
  readonly domainRefSupplier: iSQL.PostgreSqlDomainReferenceSupplier;
  readonly columns: schemas.TypicalTableColumns;

  constructor(
    readonly state: iSQL.DcpTemplateState,
    readonly hubName: HubName,
    readonly keys: {
      domain: iSQL.PostgreSqlDomainSupplier;
      columnName?: iSQL.SqlTableColumnNameFlexible;
    }[],
    options?: {
      hubIdDomain?: iSQL.PostgreSqlDomain;
      provDomain?: iSQL.PostgreSqlDomain;
      domainRefSupplier?: iSQL.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, `hub_${hubName}`);
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new schemas.TypicalDomainReference(state.schema, domain);
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

    this.hubId = this.hubIdDomain.tableColumn(this);
    this.keyColumns = [];
    for (const key of this.keys) {
      const domain = key.domain(state);
      this.keyColumns.push(
        domain.tableColumn(this, { columnName: key.columnName }),
      );
    }

    this.columns = {
      all: [
        this.hubId,
        ...this.keyColumns,
        loadedOnTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provDomain.tableColumn(this),
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.keyColumns,
      }],
    };
  }
}

/**
 * LinkTable automates the creation of Data Vault 2.0 physical Link tables
 * which connect one or more Hubs together.
 */
export class LinkTable extends schemas.TypicalTable {
  readonly linkIdDomain: iSQL.PostgreSqlDomain;
  readonly linkId: iSQL.TypedSqlTableColumn;
  readonly linkIdRefDomain: iSQL.PostgreSqlDomainReference;
  readonly hubColumns: iSQL.TypedSqlTableColumn[];
  readonly provDomain: iSQL.PostgreSqlDomain;
  readonly domainRefSupplier: iSQL.PostgreSqlDomainReferenceSupplier;
  readonly columns: schemas.TypicalTableColumns;

  constructor(
    readonly state: iSQL.DcpTemplateState,
    readonly linkName: LinkName,
    readonly hubs: HubTable[],
    options?: {
      hubIdDomain?: iSQL.PostgreSqlDomain;
      provDomain?: iSQL.PostgreSqlDomain;
      domainRefSupplier?: iSQL.PostgreSqlDomainReferenceSupplier;
    },
  ) {
    super(state, `link_${linkName}`);
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new schemas.TypicalDomainReference(state.schema, domain);
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

    this.linkId = this.linkIdDomain.tableColumn(this);
    this.hubColumns = [];
    for (const hub of this.hubs) {
      const domain = hub.hubIdRefDomain;
      this.hubColumns.push(
        domain.reference.tableColumn(this, {
          columnName: `${hub.hubName}_hub_id`,
          isNotNullable: true,
          foreignKey: { table: hub, column: hub.hubId },
        }),
      );
    }

    this.columns = {
      all: [
        this.linkId,
        ...this.hubColumns,
        loadedOnTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provDomain.tableColumn(this),
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.hubColumns,
      }],
    };
  }
}

/**
 * SatelliteTable automates the creation of Data Vault 2.0 physical Satellite
 * tables that may elaborate or further describe an existing Hub or Link.
 * 
 * Ref: https://www.sciencedirect.com/topics/computer-science/data-vault-satellite
 */
export class SatelliteTable extends schemas.TypicalTable {
  readonly satIdDomain: iSQL.PostgreSqlDomain;
  readonly satId: iSQL.TypedSqlTableColumn;
  readonly parentId: iSQL.TypedSqlTableColumn;
  readonly satIdRefDomain: iSQL.PostgreSqlDomainReference;
  readonly provDomain: iSQL.PostgreSqlDomain;
  readonly domainRefSupplier: iSQL.PostgreSqlDomainReferenceSupplier;
  readonly columns: schemas.TypicalTableColumns;

  constructor(
    readonly state: iSQL.DcpTemplateState,
    readonly parent: HubTable | LinkTable,
    readonly satelliteName: SatelliteName,
    readonly organicColumns: (
      table: SatelliteTable,
    ) => schemas.TypicalTableColumns,
    options?: {
      satIdDomain?: iSQL.PostgreSqlDomain;
      provDomain?: iSQL.PostgreSqlDomain;
      domainRefSupplier?: iSQL.PostgreSqlDomainReferenceSupplier;
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

    this.satId = this.satIdDomain.tableColumn(this);
    this.parentId = this.parent instanceof HubTable
      ? this.parent.hubIdRefDomain.reference.tableColumn(this, {
        isNotNullable: true,
        foreignKey: { table: this.parent, column: this.parent.hubId },
      })
      : this.parent.linkIdRefDomain.reference.tableColumn(this, {
        isNotNullable: true,
        foreignKey: { table: this.parent, column: this.parent.linkId },
      });
    const attributes = organicColumns(this);
    this.columns = {
      all: [
        this.satId,
        this.parentId,
        ...attributes.all,
        loadedOnTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provDomain.tableColumn(this),
      ],
      unique: attributes.unique,
    };
  }
}

export class TelemetrySpanHub extends HubTable {
  constructor(readonly state: iSQL.DcpTemplateState) {
    super(state, "telemetry_span", [{
      domain: telemetrySpanIdDomain,
    }]);
  }
}

export class ExceptionHub extends HubTable {
  constructor(readonly state: iSQL.DcpTemplateState) {
    super(state, "exception", [{
      domain: hubTextBusinessKeyDomain("exception_hub_key", "key"),
    }]);
  }
}

export class ExceptionSpanLink extends LinkTable {
  constructor(
    readonly state: iSQL.DcpTemplateState,
    readonly exception: ExceptionHub,
    readonly span: TelemetrySpanHub,
  ) {
    super(state, "exception_telemetry_span", [exception, span]);
  }
}

export class ExceptionDiagnostics extends SatelliteTable {
  constructor(
    readonly state: iSQL.DcpTemplateState,
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
            new schemas.TypicalTableColumnInstance(
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
    readonly state: iSQL.DcpTemplateState,
    readonly parent: ExceptionHub,
  ) {
    super(
      state,
      parent,
      "exception_http_client",
      (table) => {
        return {
          all: ["http_req", "http_resp"].map((name) =>
            new schemas.TypicalTableColumnInstance(
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

export interface HousekeepingEntities {
  readonly exceptionHub: ExceptionHub;
  readonly exceptionDiags: ExceptionDiagnostics;
  readonly exceptionHttpClient: ExceptionHttpClient;
  readonly telemetrySpanHub: TelemetrySpanHub;
  readonly exceptSpanLink: ExceptionSpanLink;

  readonly tables: () => iSQL.SqlTable[];
}

export function typicalHousekeepingEntities(
  state: iSQL.DcpTemplateState,
): HousekeepingEntities {
  const exceptionHub = new ExceptionHub(state);
  const exceptionDiags = new ExceptionDiagnostics(state, exceptionHub);
  const exceptionHttpClient = new ExceptionHttpClient(state, exceptionHub);
  const telemetrySpanHub = new TelemetrySpanHub(state);
  const exceptSpanLink = new ExceptionSpanLink(
    state,
    exceptionHub,
    telemetrySpanHub,
  );

  return {
    exceptionHub,
    exceptionDiags,
    exceptionHttpClient,
    telemetrySpanHub,
    exceptSpanLink,
    tables: () => {
      return [
        exceptionHub,
        exceptionDiags,
        exceptionHttpClient,
        telemetrySpanHub,
        exceptSpanLink,
      ];
    },
  };
}
