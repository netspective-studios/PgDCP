import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import { schemas } from "../mod.ts";

export const loadedOnTimestampDomain: SQLa.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("loaded_at_timestamptz", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "timestamptz", {
      defaultColumnName: "loaded_at",
      defaultSqlExpr: "current_timestamp",
    });
  });
};

export const loadedByUserDomain: SQLa.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("loaded_by_db_user_name", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "name", {
      defaultColumnName: "loaded_by",
      defaultSqlExpr: "current_user",
    });
  });
};

export const provenanceUriDomain: SQLa.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("provenance_uri", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      defaultColumnName: "provenance",
      defaultSqlExpr: "'system://'",
    });
  });
};

export const contentHashDomain: SQLa.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("content_hash", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      isNotNullable: true,
    });
  });
};

export const ftsVectorsSupplierDomain: SQLa.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("fts_vector_supplier", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "ltree");
  });
};

export const ftsVectorsTextDomain: SQLa.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("fts_vector_text", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text");
  });
};

export const ftsVectorsDomain: SQLa.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("fts_vector", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "tsvector");
  });
};

export class DataVaultIdentity extends SQLaT.TypicalDomain {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly name: SQLa.PostgreSqlDomainName,
    readonly defaultColumnName: SQLa.SqlTableColumnNameFlexible,
  ) {
    super(schema, name, "UUID", {
      defaultColumnName,
      isNotNullable: true,
      defaultSqlExpr: "gen_random_uuid()",
    });
  }

  readonly tableColumn: SQLa.TypedSqlTableColumnSupplier = (
    table,
    options?,
  ): SQLa.TypedSqlTableColumn => {
    const column: SQLa.TypedSqlTableColumn = new SQLaT
      .TypicalTypedTableColumnInstance(
      this.schema,
      table,
      options?.columnName || this.defaultColumnName,
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

export function hubIdDomain(name: HubName): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`hub_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "hub_id");
    });
  };
}

export function linkIdDomain(name: LinkName): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`link_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "link_id");
    });
  };
}

export function satelliteIdDomain(
  name: SatelliteName,
): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(`sat_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "sat_id");
    });
  };
}

export function hubTextBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "text", {
        defaultColumnName,
        isNotNullable: true,
      });
    });
  };
}

export function hubUriBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "text", {
        defaultColumnName,
        isNotNullable: true,
        // TODO: add a constraint to verify that it's a valid URI
      });
    });
  };
}

export function hubLtreeBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "ltree", {
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
export class HubTable extends SQLaT.TypicalTable {
  readonly hubIdDomain: SQLa.PostgreSqlDomain;
  readonly hubId: SQLa.TypedSqlTableColumn;
  readonly hubIdRefDomain: SQLa.PostgreSqlDomainReference;
  readonly keyColumns: SQLa.TypedSqlTableColumn[];
  readonly provDomain: SQLa.PostgreSqlDomain;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier;
  readonly columns: SQLaT.TypicalTableColumns;
  readonly ag: SQLa.SqlAffinityGroup;
  readonly lcf: SQLa.PostgreSqlLifecycleFunctions;

  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly hubName: HubName,
    readonly keys: {
      domain: SQLa.PostgreSqlDomainSupplier;
      columnName?: SQLa.SqlTableColumnNameFlexible;
    }[],
    options?: {
      hubIdDomain?: SQLa.PostgreSqlDomain;
      provDomain?: SQLa.PostgreSqlDomain;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier;
      parentAffinityGroup?: SQLa.SqlAffinityGroup;
    },
  ) {
    super(state, `hub_${hubName}`);
    this.ag = new schemas.TypicalAffinityGroup(
      `hub_${hubName}`,
      options?.parentAffinityGroup,
    );
    this.lcf = this.ag.lcFunctions; // just a shortcut for now, might change in the future
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new SQLaT.TypicalDomainReference(state.schema, domain);
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
export class LinkTable extends SQLaT.TypicalTable {
  readonly linkIdDomain: SQLa.PostgreSqlDomain;
  readonly linkId: SQLa.TypedSqlTableColumn;
  readonly linkIdRefDomain: SQLa.PostgreSqlDomainReference;
  readonly hubColumns: SQLa.TypedSqlTableColumn[];
  readonly provDomain: SQLa.PostgreSqlDomain;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier;
  readonly columns: SQLaT.TypicalTableColumns;
  readonly ag: SQLa.SqlAffinityGroup;
  readonly lcf: SQLa.PostgreSqlLifecycleFunctions;

  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly linkName: LinkName,
    readonly hubs: HubTable[],
    options?: {
      hubIdDomain?: SQLa.PostgreSqlDomain;
      provDomain?: SQLa.PostgreSqlDomain;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier;
      parentAffinityGroup?: SQLa.SqlAffinityGroup;
    },
  ) {
    super(state, `link_${linkName}`);
    this.ag = new schemas.TypicalAffinityGroup(
      `link_${linkName}`,
      options?.parentAffinityGroup,
    );
    this.lcf = this.ag.lcFunctions; // just a shortcut for now, might change in the future
    this.domainRefSupplier = options?.domainRefSupplier || ((domain, state) => {
      return new SQLaT.TypicalDomainReference(state.schema, domain);
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
export class SatelliteTable extends SQLaT.TypicalTable {
  readonly satIdDomain: SQLa.PostgreSqlDomain;
  readonly satId: SQLa.TypedSqlTableColumn;
  readonly parentId: SQLa.TypedSqlTableColumn;
  readonly satIdRefDomain: SQLa.PostgreSqlDomainReference;
  readonly provDomain: SQLa.PostgreSqlDomain;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier;
  readonly columns: SQLaT.TypicalTableColumns;
  readonly attributes: SQLaT.TypicalTableColumns;
  readonly ag: SQLa.SqlAffinityGroup;
  readonly lcf: SQLa.PostgreSqlLifecycleFunctions;

  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parent: HubTable | LinkTable,
    readonly satelliteName: SatelliteName,
    readonly organicColumns: (
      table: SatelliteTable,
    ) => SQLaT.TypicalTableColumns,
    options?: {
      satIdDomain?: SQLa.PostgreSqlDomain;
      provDomain?: SQLa.PostgreSqlDomain;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier;
      parentAffinityGroup?: SQLa.SqlAffinityGroup;
    },
  ) {
    super(state, `sat_${satelliteName}`);
    this.ag = new schemas.TypicalAffinityGroup(
      `sat_${satelliteName}`,
      options?.parentAffinityGroup,
    );
    this.lcf = this.ag.lcFunctions; // just a shortcut for now, might change in the future
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
    this.attributes = organicColumns(this);
    this.columns = {
      all: [
        this.satId,
        this.parentId,
        ...this.attributes.all,
        loadedOnTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provDomain.tableColumn(this),
      ],
      unique: this.attributes.unique,
    };
  }
}
