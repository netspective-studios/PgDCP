import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import * as dv from "./data-vault.ts";

export interface UrlVault {
  readonly hub: UrlHub;
  readonly labels: UrlLabelSat;
}

export class UrlHub
  extends dv.HubTable<dv.SingleKeyHubRecord<dv.HubTextBusinessKeyDomainValue>> {
  readonly labelsSat: UrlLabelSat;

  constructor(readonly state: SQLa.DcpTemplateState, name = "url") {
    super(state, name, [{
      domain: dv.hubTextBusinessKeyDomain(`${name}_hub_key`, "key"),
    }]);

    this.labelsSat = new UrlLabelSat(state, this);
  }
}

export class UrlLabelSat extends dv.SatelliteTable<
  UrlHub,
  dv.SatelliteRecord & {
    readonly hubUrlId: dv.HubIdDomainValue;
    readonly label: string;
  }
> {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parentHub: UrlHub,
  ) {
    super(
      state,
      dv.satelliteParentHub(parentHub),
      `${parentHub.hubName}_label`,
      (table) => {
        return {
          all: [
            new SQLaT.TypicalTableColumnInstance(
              state.schema,
              table,
              "label",
              "text",
            ),
          ],
        };
      },
    );
  }

  labelsView(): SQLa.SqlView {
    // deno-lint-ignore no-this-alias
    const satellite = this;
    return new (class extends SQLaT.TypicalView {
      readonly createSql = () => {
        // deno-fmt-ignore
        return this.SQL`CREATE OR REPLACE VIEW ${this.qName} AS 
        select hub.key, sat.label,
         from ${satellite.parentHub.qName} hub, ${satellite.qName} sat
        where hub.${satellite.parentHub.hubId.name} = sat.${satellite.parentId.name}`; // don't include trailing semi-colon in SQL, since it's a "statement" not complete SQL
      };
    })(this.state, `${this.parentHub.hubName}_label`);
  }
}
