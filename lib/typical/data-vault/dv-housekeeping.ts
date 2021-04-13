import * as SQLa from "../../mod.ts";
import * as dve from "./dv-exception.ts";
import * as dvt from "./dv-telemetry.ts";

export interface HousekeepingEntities {
  readonly exception: dve.ExceptionVault;
  readonly telemetry: dvt.TelemetryVault;
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
    exception: {
      hub: exceptionHub,
      diags: exceptionDiags,
      httpClient: exceptionHttpClient,
    },
    telemetry: {
      spanHub: telemetrySpanHub,
      metricHub: telemetryMetricHub,
      metricGaugeInstance: telemetryMetricGaugeInstance,
      metricCounterInstance: telemetryMetricCounterInstance,
      metricInfoInstance: telemetryMetricInfoInstance,
    },
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
