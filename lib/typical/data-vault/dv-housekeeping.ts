import * as SQLa from "../../mod.ts";
import * as dve from "./dv-exception.ts";
import * as dvt from "./dv-telemetry.ts";

export interface HousekeepingEntities {
  readonly exceptionHub: dve.ExceptionHub;
  readonly exceptionDiags: dve.ExceptionDiagnostics;
  readonly exceptionHttpClient: dve.ExceptionHttpClient;
  readonly telemetrySpanHub: dvt.TelemetrySpanHub;
  readonly telemetryMetricHub: dvt.TelemetryMetricHub;
  readonly telemetryMetricGaugeInstance: dvt.TelemetryMetricGaugeInstance;
  readonly telemetryMetricCounterInstance: dvt.TelemetryMetricCounterInstance;
  readonly telemetryMetricInfoInstance: dvt.TelemetryMetricInfoInstance;
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
  const telemetryMetricHub = new dvt.TelemetryMetricHub(state);
  const telemetryMetricGaugeInstance = new dvt.TelemetryMetricGaugeInstance(
    state,
    telemetryMetricHub,
    dvt.telemetryMetricRealValueDomain,
  );
  const telemetryMetricCounterInstance = new dvt.TelemetryMetricCounterInstance(
    state,
    telemetryMetricHub,
    dvt.telemetryMetricRealValueDomain,
  );
  const telemetryMetricInfoInstance = new dvt.TelemetryMetricInfoInstance(
    state,
    telemetryMetricHub,
  );
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
    telemetryMetricHub,
    telemetryMetricGaugeInstance,
    telemetryMetricCounterInstance,
    telemetryMetricInfoInstance,
    exceptSpanLink,
    tables: () => {
      return [
        exceptionHub,
        exceptionDiags,
        exceptionHttpClient,
        telemetrySpanHub,
        telemetryMetricHub,
        telemetryMetricGaugeInstance,
        telemetryMetricCounterInstance,
        telemetryMetricInfoInstance,
        exceptSpanLink,
      ];
    },
  };
}
