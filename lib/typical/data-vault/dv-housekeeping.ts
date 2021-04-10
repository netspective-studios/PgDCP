import * as SQLa from "../../mod.ts";
import * as dve from "./dv-exception.ts";
import * as dvt from "./dv-telemetry.ts";

export interface HousekeepingEntities {
  readonly exceptionHub: dve.ExceptionHub;
  readonly exceptionDiags: dve.ExceptionDiagnostics;
  readonly exceptionHttpClient: dve.ExceptionHttpClient;
  readonly telemetrySpanHub: dvt.TelemetrySpanHub;
  readonly exceptSpanLink: dvt.ExceptionSpanLink;

  readonly tables: () => SQLa.SqlTable[];
}

export function typicalHousekeepingEntities(
  state: SQLa.DcpTemplateState,
): HousekeepingEntities {
  const exceptionHub = new dve.ExceptionHub(state);
  const exceptionDiags = new dve.ExceptionDiagnostics(state, exceptionHub);
  const exceptionHttpClient = new dve.ExceptionHttpClient(state, exceptionHub);
  const telemetrySpanHub = new dvt.TelemetrySpanHub(state);
  const exceptSpanLink = new dvt.ExceptionSpanLink(
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
