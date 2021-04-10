import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import * as dv from "./data-vault.ts";

export class ExceptionHub extends dv.HubTable {
  constructor(readonly state: SQLa.DcpTemplateState) {
    super(state, "exception", [{
      domain: dv.hubTextBusinessKeyDomain("exception_hub_key", "key"),
    }]);
  }
}

export class ExceptionDiagnostics extends dv.SatelliteTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
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
            new SQLaT.TypicalTableColumnInstance(
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

  diagnosticsView(): SQLa.SqlView {
    // deno-lint-ignore no-this-alias
    const satellite = this;
    return new (class extends SQLaT.TypicalView {
      readonly createSql = () => {
        // deno-fmt-ignore
        return this.SQL`CREATE OR REPLACE VIEW ${this.qName} AS 
        select hub.key, 
               sat.message,
               sat.err_returned_sqlstate,
               sat.err_pg_exception_detail,
               sat.err_pg_exception_hint,
               sat.err_pg_exception_context
         from ${satellite.parent.qName} hub, ${satellite.qName} sat
        where hub.hub_id = sat.hub_exception_id`; // don't include trailing semi-colon in SQL, since it's a "statement" not complete SQL
      };
    })(this.state, "exception_diagnostics");
  }
}

export class ExceptionHttpClient extends dv.SatelliteTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parent: ExceptionHub,
  ) {
    super(
      state,
      parent,
      "exception_http_client",
      (table) => {
        return {
          all: ["http_req", "http_resp"].map((name) =>
            new SQLaT.TypicalTableColumnInstance(
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

  httpClientView(): SQLa.SqlView {
    // deno-lint-ignore no-this-alias
    const satellite = this;
    return new (class extends SQLaT.TypicalView {
      readonly createSql = () => {
        // deno-fmt-ignore
        return this.SQL`CREATE OR REPLACE VIEW ${this.qName} AS 
        select hub.key, 
               sat.http_req,
               sat.http_resp
         from ${satellite.parent.qName} hub, ${satellite.qName} sat
        where hub.hub_id = sat.hub_exception_id`; // don't include trailing semi-colon in SQL, since it's a "statement" not complete SQL
      };
    })(this.state, "exception_http_client");
  }
}
