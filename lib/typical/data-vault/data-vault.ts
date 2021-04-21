import { uuid } from "../../deps.ts";
import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import { schemas } from "../mod.ts";

export type LoadedAtTimestampDomainValue = Date;
export const loadedAtTimestampDomain: SQLa.PostgreSqlDomainSupplier<
  LoadedAtTimestampDomainValue
> = (
  state,
) => {
  return state.schema.useDomain("loaded_at_timestamptz", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "timestamptz", {
      defaultColumnName: "loaded_at",
      defaultSqlExpr: "current_timestamp",
      defaultStaticValue: () => {
        return new Date();
      },
      defaultDelimitedTextValue: () => {
        return new Date().toISOString();
      },
    });
  });
};

export type LoadedByUserDomainValue = string;
export const loadedByUserDomain: SQLa.PostgreSqlDomainSupplier<
  LoadedByUserDomainValue
> = (
  state,
) => {
  return state.schema.useDomain("loaded_by_db_user_name", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "name", {
      defaultColumnName: "loaded_by",
      defaultSqlExpr: "current_user",
    });
  });
};

export type ProvenanceUriDomainValue = string;
export const provenanceUriDomain: SQLa.PostgreSqlDomainSupplier<
  ProvenanceUriDomainValue
> = (state) => {
  return state.schema.useDomain("provenance_uri", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      defaultColumnName: "provenance",
      defaultSqlExpr: "'system://'",
    });
  });
};

export type ContentHashDomainValue = string;
export const contentHashDomain: SQLa.PostgreSqlDomainSupplier<
  ContentHashDomainValue
> = (state) => {
  return state.schema.useDomain("content_hash", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      isNotNullable: true,
    });
  });
};

export type FtsVectorsSupplierDomainValue = string;
export const ftsVectorsSupplierDomain: SQLa.PostgreSqlDomainSupplier<
  FtsVectorsSupplierDomainValue
> = (
  state,
) => {
  return state.schema.useDomain("fts_vector_supplier", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "ltree");
  });
};

export type FtsVectorsTextDomainValue = string;
export const ftsVectorsTextDomain: SQLa.PostgreSqlDomainSupplier<
  FtsVectorsTextDomainValue
> = (
  state,
) => {
  return state.schema.useDomain("fts_vector_text", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text");
  });
};

export type FtsVectorsDomainValue = string;
export const ftsVectorsDomain: SQLa.PostgreSqlDomainSupplier<
  FtsVectorsDomainValue
> = (state) => {
  return state.schema.useDomain("fts_vector", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "tsvector");
  });
};

export type DataVaultIdentityValue = string;
export class DataVaultIdentity
  extends SQLaT.TypicalDomain<DataVaultIdentityValue> {
  constructor(
    readonly schema: SQLa.PostgreSqlSchema,
    readonly name: SQLa.PostgreSqlDomainName,
    readonly defaultColumnName: SQLa.SqlTableColumnNameFlexible,
  ) {
    super(schema, name, "UUID", {
      defaultColumnName,
      isNotNullable: true,
      defaultSqlExpr: "gen_random_uuid()",
      defaultStaticValue: () => {
        return uuid.v4.generate();
      },
      defaultDelimitedTextValue: () => {
        return this.options?.defaultStaticValue
          ? this.options?.defaultStaticValue()
          : ``;
      },
    });
  }

  readonly tableColumn: SQLa.TypedSqlTableColumnSupplier<
    DataVaultIdentityValue
  > = (
    table,
    options?,
  ): SQLa.TypedSqlTableColumn<DataVaultIdentityValue> => {
    const column: SQLa.TypedSqlTableColumn<DataVaultIdentityValue> = new SQLaT
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

export type HubIdDomainValue = string;
export function hubIdDomain(
  name: HubName,
): SQLa.PostgreSqlDomainSupplier<HubIdDomainValue> {
  return (state) => {
    return state.schema.useDomain(`hub_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "hub_id");
    });
  };
}

export type LinkIdDomainValue = string;
export function linkIdDomain(
  name: LinkName,
): SQLa.PostgreSqlDomainSupplier<LinkIdDomainValue> {
  return (state) => {
    return state.schema.useDomain(`link_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "link_id");
    });
  };
}

export type SatelliteIdDomainValue = string;
export function satelliteIdDomain(
  name: SatelliteName,
): SQLa.PostgreSqlDomainSupplier<SatelliteIdDomainValue> {
  return (state) => {
    return state.schema.useDomain(`sat_${name}_id`, (name, schema) => {
      return new DataVaultIdentity(schema, name, "sat_id");
    });
  };
}

export type HubTextBusinessKeyDomainValue = string;
export function hubTextBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier<HubTextBusinessKeyDomainValue> {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "text", {
        defaultColumnName,
        isNotNullable: true,
      });
    });
  };
}

export type HubUriBusinessKeyDomainValue = string;
export function hubUriBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier<HubUriBusinessKeyDomainValue> {
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

export type HubLtreeBusinessKeyDomainValue = string;
export function hubLtreeBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier<HubLtreeBusinessKeyDomainValue> {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "ltree", {
        defaultColumnName,
        isNotNullable: true,
        overrideTableColOptions: (options?) => {
          return {
            ...options,
            operatorSql: {
              equal: `OPERATOR(${schemas.extensions.qualifiedReference("=")})`,
            },
          };
        },
      });
    });
  };
}

export type HubTemporalBusinessKeyDomainValue = Date;
export function hubTemporalBusinessKeyDomain(
  name: SQLa.PostgreSqlDomainName,
  defaultColumnName: SQLa.SqlTableColumnNameFlexible,
): SQLa.PostgreSqlDomainSupplier<HubTemporalBusinessKeyDomainValue> {
  return (state) => {
    return state.schema.useDomain(name, (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "timestamptz", {
        defaultColumnName,
        isNotNullable: true,
      });
    });
  };
}

export interface HubRecord<KeyType, IdType extends HubIdDomainValue> {
  readonly hubId?: IdType;
  readonly key: KeyType;
  readonly loadedAt?: LoadedAtTimestampDomainValue;
  readonly loadedBy?: LoadedByUserDomainValue;
  readonly provenance?: ProvenanceUriDomainValue;
  readonly [index: string]: unknown;
}

/**
 * HubTable automates the creation of Data Vault 2.0 physical Hub tables.
 * 
 * Ref: https://www.sciencedirect.com/topics/computer-science/data-vault-model
 */
export class HubTable extends SQLaT.TypicalTable
  implements SQLa.SqlTableUpsertable {
  readonly hubIdDomain: SQLa.PostgreSqlDomain<HubIdDomainValue>;
  readonly hubId: SQLa.TypedSqlTableColumn<HubIdDomainValue>;
  readonly hubIdRefDomain: SQLa.PostgreSqlDomainReference<HubIdDomainValue>;
  readonly keyColumns: SQLa.TypedSqlTableColumn<unknown>[];
  readonly provDomain: SQLa.PostgreSqlDomain<ProvenanceUriDomainValue>;
  readonly provColumn: SQLa.TypedSqlTableColumn<ProvenanceUriDomainValue>;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier<
    HubIdDomainValue
  >;
  readonly columns: SQLaT.TypicalTableColumns;
  readonly ag: SQLa.SqlAffinityGroup;
  readonly lcf: SQLa.PostgreSqlLifecycleFunctions;

  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly hubName: HubName,
    readonly keys: {
      // deno-lint-ignore no-explicit-any
      domain: SQLa.PostgreSqlDomainSupplier<any>;
      columnName?: SQLa.SqlTableColumnNameFlexible;
    }[],
    options?: {
      hubIdDomain?: SQLa.PostgreSqlDomain<HubIdDomainValue>;
      provDomain?: SQLa.PostgreSqlDomain<ProvenanceUriDomainValue>;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier<
        HubIdDomainValue
      >;
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

    this.provColumn = this.provDomain.tableColumn(this);
    this.columns = {
      all: [
        this.hubId,
        ...this.keyColumns,
        loadedAtTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provColumn,
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.keyColumns,
      }],
    };
  }

  upsertRoutinesSQL(): SQLa.DcpInterpolationResult {
    const upsertSR = this.lcFunctions.upsert(this.state);
    const upsertedSR = this.lcFunctions.upserted(this.state);
    const embedState = {
      ...this.state,
      headers: [], // since we're embedding SQL, no headers needed
    };

    // deno-fmt-ignore
    return SQLa.SQL(embedState.ic, embedState)`-- TODO: add observability_span_id text or observability parameter to tie in errors
      CREATE OR REPLACE FUNCTION ${upsertedSR.qName}(${this.keyColumns.map(kc => `${kc.name} ${kc.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) RETURNS ${this.qName} AS $${upsertedSR.bodyBlockName}$
      DECLARE 
        inserted_row ${this.qName};
      BEGIN
          select * into inserted_row 
            from ${this.qName} hub
           where ${this.keyColumns.map((kc, idx) => kc.compareEqualSql(`hub.${kc.name}`, `$${idx+1}`)).join(' AND ')}
             and hub.provenance = $${this.keyColumns.length+1};
          if inserted_row is null then
            insert into ${this.qName} (${this.keyColumns.map(kc => kc.name).join(', ')}, provenance)
              values (${this.keyColumns.map((_, idx) => `$${idx+1}`).join(', ')}, $${this.keyColumns.length+1}) 
              returning * into inserted_row;
          end if;
          return inserted_row;
      END; $${upsertedSR.bodyBlockName}$ LANGUAGE plpgsql;

      CREATE OR REPLACE PROCEDURE ${upsertSR.qName}(${this.keyColumns.map(kc => `${kc.name} ${kc.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) AS $${upsertSR.bodyBlockName}$
      BEGIN
          insert into ${this.qName} 
                 (${this.keyColumns.map(kc => kc.name).join(', ')}, provenance)
          values (${this.keyColumns.map((_, idx) => `$${idx+1}`).join(', ')}, $${this.keyColumns.length+1}) 
              on conflict do nothing;
      END; $${upsertSR.bodyBlockName}$ LANGUAGE plpgsql;`;
  }
}

export const keepHubColumnInDelimitedText: SQLa.SqlTableColumnFilter<
  SQLa.SqlTableColumn<HubIdDomainValue>,
  HubTable
> = () => {
  return true;
};

export interface LinkRecord<IdType extends LinkIdDomainValue> {
  readonly linkId?: IdType;
  readonly loadedAt?: LoadedAtTimestampDomainValue;
  readonly loadedBy?: LoadedByUserDomainValue;
  readonly provenance?: ProvenanceUriDomainValue;
  readonly [index: string]: unknown;
}

/**
 * LinkTable automates the creation of Data Vault 2.0 physical Link tables
 * which connect one or more Hubs together.
 */
export class LinkTable extends SQLaT.TypicalTable
  implements SQLa.SqlTableUpsertable {
  readonly linkIdDomain: SQLa.PostgreSqlDomain<LinkIdDomainValue>;
  readonly linkId: SQLa.TypedSqlTableColumn<LinkIdDomainValue>;
  readonly linkIdRefDomain: SQLa.PostgreSqlDomainReference<LinkIdDomainValue>;
  readonly hubColumns: SQLa.TypedSqlTableColumn<HubIdDomainValue>[];
  readonly provDomain: SQLa.PostgreSqlDomain<ProvenanceUriDomainValue>;
  readonly provColumn: SQLa.TypedSqlTableColumn<ProvenanceUriDomainValue>;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier<
    LinkIdDomainValue
  >;
  readonly columns: SQLaT.TypicalTableColumns;
  readonly ag: SQLa.SqlAffinityGroup;
  readonly lcf: SQLa.PostgreSqlLifecycleFunctions;

  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly linkName: LinkName,
    readonly hubs: HubTable[],
    options?: {
      hubIdDomain?: SQLa.PostgreSqlDomain<LinkIdDomainValue>;
      provDomain?: SQLa.PostgreSqlDomain<LinkIdDomainValue>;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier<
        LinkIdDomainValue
      >;
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

    this.provColumn = this.provDomain.tableColumn(this);
    this.columns = {
      all: [
        this.linkId,
        ...this.hubColumns,
        loadedAtTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provColumn,
      ],
      unique: [{
        name: `${this.name}_unq`,
        columns: this.hubColumns,
      }],
    };
  }

  upsertRoutinesSQL(): SQLa.DcpInterpolationResult {
    const upsertedSR = this.lcFunctions.upserted(this.state);
    const upsertSR = this.lcFunctions.upsert(this.state);
    const embedState = {
      ...this.state,
      headers: [], // since we're embedding SQL, no headers needed
    };

    // deno-fmt-ignore
    return SQLa.SQL(embedState.ic, embedState)`-- TODO: add observability_span_id text or observability parameter to tie in errors
      CREATE OR REPLACE FUNCTION ${upsertedSR.qName}(${this.hubColumns.map(kc => `${kc.name} ${kc.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) RETURNS ${this.qName} AS $${upsertedSR.bodyBlockName}$
      DECLARE 
          inserted_row ${this.qName};
      BEGIN
          select * into inserted_row 
            from ${this.qName} link
           where ${this.hubColumns.map((kc, idx) => kc.compareEqualSql(`link.${kc.name}`, `$${idx+1}`)).join(' AND ')}
             and link.provenance = $${this.hubColumns.length+1};
          if inserted_row is null then
            insert into ${this.qName} (${this.hubColumns.map(kc => kc.name).join(', ')}, provenance)
              values (${this.hubColumns.map((_, idx) => `$${idx+1}`).join(', ')}, $${this.hubColumns.length+1})
              returning * into inserted_row;
          end if;
          return inserted_row;
      END; $${upsertedSR.bodyBlockName}$ LANGUAGE plpgsql;

      CREATE OR REPLACE PROCEDURE ${upsertSR.qName}(${this.hubColumns.map(kc => `${kc.name} ${kc.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) AS $${upsertSR.bodyBlockName}$
      BEGIN
          insert into ${this.qName} 
                 (${this.hubColumns.map(kc => kc.name).join(', ')}, provenance)
          values (${this.hubColumns.map((_, idx) => `$${idx+1}`).join(', ')}, $${this.hubColumns.length+1})
              on conflict do nothing;
      END; $${upsertSR.bodyBlockName}$ LANGUAGE plpgsql;`;
  }
}

export const keepLinkColumnInDelimitedText: SQLa.SqlTableColumnFilter<
  SQLa.SqlTableColumn<LinkIdDomainValue>,
  LinkTable
> = () => {
  return true;
};

export interface SatelliteRecord<IdType extends SatelliteIdDomainValue> {
  readonly satId?: IdType;
  readonly loadedAt?: LoadedAtTimestampDomainValue;
  readonly loadedBy?: LoadedByUserDomainValue;
  readonly provenance?: ProvenanceUriDomainValue;
  readonly [index: string]: unknown;
}

/**
 * SatelliteTable automates the creation of Data Vault 2.0 physical Satellite
 * tables that may elaborate or further describe an existing Hub or Link.
 * 
 * Ref: https://www.sciencedirect.com/topics/computer-science/data-vault-satellite
 */
export class SatelliteTable extends SQLaT.TypicalTable
  implements SQLa.SqlTableUpsertable {
  readonly satIdDomain: SQLa.PostgreSqlDomain<SatelliteIdDomainValue>;
  readonly satId: SQLa.TypedSqlTableColumn<SatelliteIdDomainValue>;
  readonly parentId: SQLa.TypedSqlTableColumn<SatelliteIdDomainValue>;
  readonly satIdRefDomain: SQLa.PostgreSqlDomainReference<
    SatelliteIdDomainValue
  >;
  readonly provDomain: SQLa.PostgreSqlDomain<ProvenanceUriDomainValue>;
  readonly provColumn: SQLa.TypedSqlTableColumn<ProvenanceUriDomainValue>;
  readonly domainRefSupplier: SQLa.PostgreSqlDomainReferenceSupplier<
    SatelliteIdDomainValue
  >;
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
      satIdDomain?: SQLa.PostgreSqlDomain<SatelliteIdDomainValue>;
      provDomain?: SQLa.PostgreSqlDomain<SatelliteIdDomainValue>;
      domainRefSupplier?: SQLa.PostgreSqlDomainReferenceSupplier<
        SatelliteIdDomainValue
      >;
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
    this.provColumn = this.provDomain.tableColumn(this);
    this.columns = {
      all: [
        this.satId,
        this.parentId,
        ...this.attributes.all,
        loadedAtTimestampDomain(state).tableColumn(this),
        loadedByUserDomain(state).tableColumn(this),
        this.provColumn,
      ],
      unique: this.attributes.unique,
    };
  }

  upsertRoutinesSQL(): SQLa.DcpInterpolationResult {
    const upsertedSR = this.lcFunctions.upserted(this.state);
    const upsertSR = this.lcFunctions.upsert(this.state);
    const embedState = {
      ...this.state,
      headers: [], // since we're embedding SQL, no headers needed
    };
    const satAttrs = this.attributes.all;

    // deno-fmt-ignore
    return SQLa.SQL(embedState.ic, embedState)`-- TODO: add observability_span_id text or observability parameter to tie in errors
      CREATE OR REPLACE FUNCTION ${upsertedSR.qName}(${this.parentId.name} ${this.parentId.dataType}, ${satAttrs.map(ac => `${ac.name} ${ac.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) RETURNS ${this.qName} AS $${upsertedSR.bodyBlockName}$
      DECLARE 
          inserted_row ${this.qName};
      BEGIN
          select * into inserted_row 
            from ${this.qName} sat
           where ${satAttrs.map((kc, idx) => kc.compareEqualSql(`sat.${kc.name}`, `$${idx+2}`)).join(' AND ')}
             and sat.provenance = $${satAttrs.length+2};
          if inserted_row is null then
            insert into ${this.qName} 
                     (${this.parentId.name}, ${satAttrs.map(kc => kc.name).join(', ')}, provenance)
              values ($1, ${satAttrs.map((_, idx) => `$${idx+2}`).join(', ')}, $${satAttrs.length+2})
              returning * into inserted_row;
          end if;
          return inserted_row;
      END; $${upsertedSR.bodyBlockName}$ LANGUAGE plpgsql;

      CREATE OR REPLACE PROCEDURE ${upsertSR.qName}(${this.parentId.name} ${this.parentId.dataType}, ${satAttrs.map(ac => `${ac.name} ${ac.dataType}`).join(', ')}, ${this.provColumn.name} ${this.provColumn.dataType}) AS $${upsertSR.bodyBlockName}$
      BEGIN
          insert into ${this.qName} 
                 (${this.parentId.name}, ${satAttrs.map(kc => kc.name).join(', ')}, provenance)
          values ($1, ${satAttrs.map((_, idx) => `$${idx+2}`).join(', ')}, $${satAttrs.length+2})
              on conflict do nothing;
      END; $${upsertSR.bodyBlockName}$ LANGUAGE plpgsql;`;
  }
}

export const keepSatelliteColumnInDelimitedText: SQLa.SqlTableColumnFilter<
  SQLa.SqlTableColumn<SatelliteIdDomainValue>,
  SatelliteTable
> = () => {
  return true;
};
