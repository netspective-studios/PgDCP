import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import * as dv from "./data-vault.ts";
import * as dve from "./dv-exception.ts";

export interface TelemetryVault {
  readonly spanHub: TelemetrySpanHub;
  readonly metricHub: TelemetryMetricHub;
  readonly metricGaugeInstance: TelemetryMetricGaugeInstance;
  readonly metricCounterInstance: TelemetryMetricCounterInstance;
  readonly metricInfoInstance: TelemetryMetricInfoInstance;
}

export type TelemetrySpanIdDomainValue = string;
export const telemetrySpanIdDomain: SQLa.PostgreSqlDomainSupplier<
  TelemetrySpanIdDomainValue
> = (state) => {
  return state.schema.useDomain("telemetry_span_id", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      defaultColumnName: "span_id",
      isNotNullable: true,
    });
  });
};

export class TelemetrySpanHub extends dv.HubTable<
  dv.HubRecord & { readonly spanId: TelemetrySpanIdDomainValue }
> {
  constructor(readonly state: SQLa.DcpTemplateState, name = "telemetry_span") {
    super(state, name, [{
      domain: telemetrySpanIdDomain,
    }]);
  }
}

export const telemetryMetricKeyDomain = dv.hubLtreeBusinessKeyDomain(
  "metric_key",
  "key",
);

export type TelemetryMetricLabelsDomainValue = string;
export const telemetryMetricLabelsDomain: SQLa.PostgreSqlDomainSupplier<
  TelemetryMetricLabelsDomainValue
> = (
  state,
) => {
  return state.schema.useDomain("telemetry_metric_labels", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "jsonb", {
      defaultColumnName: "labels",
    });
  });
};

export type TelemetryMetricIntValueDomainValue = number;
export const telemetryMetricIntValueDomain: SQLa.PostgreSqlDomainSupplier<
  TelemetryMetricIntValueDomainValue
> = (
  state,
) => {
  return state.schema.useDomain(
    "telemetry_metric_int_value",
    (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "integer", {
        isNotNullable: true,
      });
    },
  );
};

export type TelemetryMetricRealValueDomainValue = number;
export const telemetryMetricRealValueDomain: SQLa.PostgreSqlDomainSupplier<
  TelemetryMetricRealValueDomainValue
> = (
  state,
) => {
  return state.schema.useDomain(
    "telemetry_metric_real_value",
    (name, schema) => {
      return new SQLaT.TypicalDomain(schema, name, "real", {
        isNotNullable: true,
      });
    },
  );
};

export class TelemetryMetricHub extends dv.HubTable<
  dv.SingleKeyHubRecord<dv.HubLtreeBusinessKeyDomainValue>
> {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    name = "telemetry_metric",
  ) {
    super(state, name, [{
      domain: telemetryMetricKeyDomain,
    }]);
  }
}

export class TelemetryMetricCounterInstance extends dv.SatelliteTable<
  TelemetryMetricHub,
  dv.SatelliteRecord & {
    readonly total: number;
  }
> {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parentHub: TelemetryMetricHub,
    readonly totalDomain: SQLa.PostgreSqlDomainSupplier<number>,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier<
        TelemetryMetricLabelsDomainValue
      >;
    },
  ) {
    super(
      state,
      dv.satelliteParentHub(parentHub),
      options?.tableName || "telemetry_metric_counter",
      (table) => {
        return {
          all: [
            totalDomain(state).tableColumn(table, {
              columnName: "total",
              isNotNullable: true,
            }),
            (options?.labelsDomain || telemetryMetricLabelsDomain)(state)
              .tableColumn(table),
          ],
        };
      },
    );
  }
}

export class TelemetryMetricGaugeInstance extends dv.SatelliteTable<
  TelemetryMetricHub,
  dv.SatelliteRecord & {
    readonly value: number;
  }
> {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parentHub: TelemetryMetricHub,
    readonly valueDomain: SQLa.PostgreSqlDomainSupplier<number>,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier<
        TelemetryMetricLabelsDomainValue
      >;
    },
  ) {
    super(
      state,
      dv.satelliteParentHub(parentHub),
      options?.tableName || "telemetry_metric_gauge",
      (table) => {
        return {
          all: [
            valueDomain(state).tableColumn(table, {
              columnName: "value",
              isNotNullable: true,
            }),
            (options?.labelsDomain || telemetryMetricLabelsDomain)(state)
              .tableColumn(table),
          ],
        };
      },
    );
  }
}

export class TelemetryMetricInfoInstance
  extends dv.SatelliteTable<TelemetryMetricHub> {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parentHub: TelemetryMetricHub,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier<
        TelemetryMetricLabelsDomainValue
      >;
    },
  ) {
    super(
      state,
      dv.satelliteParentHub(parentHub),
      options?.tableName || "telemetry_metric_info",
      (table) => {
        return {
          all: [
            (options?.labelsDomain || telemetryMetricLabelsDomain)(state)
              .tableColumn(table),
          ],
        };
      },
    );
  }
}

export class ExceptionSpanLink extends dv.LinkTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly exception: dve.ExceptionHub,
    readonly span: TelemetrySpanHub,
  ) {
    super(state, "exception_telemetry_span", [exception, span]);
  }
}

export class ExceptionMetricLink extends dv.LinkTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly exception: dve.ExceptionHub,
    readonly metric: TelemetryMetricHub,
  ) {
    super(state, "exception_telemetry_metric", [exception, metric]);
  }
}
