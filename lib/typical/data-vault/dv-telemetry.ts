import * as SQLa from "../../mod.ts";
import * as SQLaT from "../mod.ts";
import * as dv from "./data-vault.ts";
import * as dve from "./dv-exception.ts";

export const telemetrySpanIdDomain: SQLa.PostgreSqlDomainSupplier = (state) => {
  return state.schema.useDomain("telemetry_span_id", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "text", {
      defaultColumnName: "span_id",
      isNotNullable: true,
    });
  });
};

export class TelemetrySpanHub extends dv.HubTable {
  constructor(readonly state: SQLa.DcpTemplateState) {
    super(state, "telemetry_span", [{
      domain: telemetrySpanIdDomain,
    }]);
  }
}

export const telemetryMetricKeyDomain = dv.hubLtreeBusinessKeyDomain(
  "metric_key",
  "metric_key",
);

export const telemtryMetricLabelsDomain: SQLa.PostgreSqlDomainSupplier = (
  state,
) => {
  return state.schema.useDomain("telemetry_metric_labels", (name, schema) => {
    return new SQLaT.TypicalDomain(schema, name, "jsonb", {
      defaultColumnName: "labels",
    });
  });
};

export const telemetryMetricIntValueDomain: SQLa.PostgreSqlDomainSupplier = (
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

export const telemetryMetricRealValueDomain: SQLa.PostgreSqlDomainSupplier = (
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

export class TelemetryMetricHub extends dv.HubTable {
  constructor(readonly state: SQLa.DcpTemplateState) {
    super(state, "telemetry_metric", [{
      domain: telemetryMetricKeyDomain,
    }]);
  }
}

export class TelemetryMetricCounterInstance extends dv.SatelliteTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parent: TelemetryMetricHub,
    readonly totalDomain: SQLa.PostgreSqlDomainSupplier,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier;
    },
  ) {
    super(
      state,
      parent,
      options?.tableName || "telemetry_metric_counter",
      (table) => {
        return {
          all: [
            totalDomain(state).tableColumn(table, {
              columnName: "total",
              isNotNullable: true,
            }),
            (options?.labelsDomain || telemtryMetricLabelsDomain)(state)
              .tableColumn(table),
          ],
        };
      },
    );
  }
}

export class TelemetryMetricGaugeInstance extends dv.SatelliteTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parent: TelemetryMetricHub,
    readonly valueDomain: SQLa.PostgreSqlDomainSupplier,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier;
    },
  ) {
    super(
      state,
      parent,
      options?.tableName || "telemetry_metric_gauge",
      (table) => {
        return {
          all: [
            valueDomain(state).tableColumn(table, {
              columnName: "value",
              isNotNullable: true,
            }),
            (options?.labelsDomain || telemtryMetricLabelsDomain)(state)
              .tableColumn(table),
          ],
        };
      },
    );
  }
}

export class TelemetryMetricInfoInstance extends dv.SatelliteTable {
  constructor(
    readonly state: SQLa.DcpTemplateState,
    readonly parent: TelemetryMetricHub,
    readonly valueDomain: SQLa.PostgreSqlDomainSupplier,
    readonly options?: {
      readonly tableName?: SQLa.SqlTableName;
      readonly labelsDomain?: SQLa.PostgreSqlDomainSupplier;
    },
  ) {
    super(
      state,
      parent,
      options?.tableName || "telemetry_metric_info",
      (table) => {
        return {
          all: [
            (options?.labelsDomain || telemtryMetricLabelsDomain)(state)
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
