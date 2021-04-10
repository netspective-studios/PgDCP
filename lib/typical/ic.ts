import { textWhitespace as tw } from "../deps.ts";
import * as SQLa from "../sqla.ts";
import * as interp from "../interpolate.ts";
import * as tmpl from "./templates.ts";

export function typicalDcpInterpolationContext(
  version: SQLa.DcpInterpolationContextVersion,
  defaultSchema: SQLa.PostgreSqlSchema,
  hrSrcSupplier: interp.TemplateProvenanceHumanReadableSourceSupplier,
): SQLa.DcpInterpolationContext {
  const dcpIC: SQLa.DcpInterpolationContext = {
    version,
    engine: {
      version,
      prepareInterpolation(
        provenance: interp.TemplateProvenance,
      ): interp.InterpolationExecution {
        return {
          provenance,
        };
      },
      prepareResult(
        interpolated: interp.InterpolatedContent,
        state: interp.InterpolationState,
        options: interp.InterpolationOptions,
      ): SQLa.DcpInterpolationResult {
        if (!SQLa.isDcpTemplateState(state)) {
          throw Error(
            `prepareResult(): state is expected to be of type DcpTemplateState not ${typeof state}`,
          );
        }
        return {
          ctx: dcpIC,
          state,
          interpolated,
          options,
        };
      },
    },
    prepareTsModuleExecution: (
      importMetaURL: string,
      defaultP?: Partial<Omit<interp.TemplateProvenance, "importMetaURL">>,
    ): interp.InterpolationExecution => {
      const provenance: interp.TypeScriptModuleProvenance & interp.Indentable =
        {
          source: importMetaURL,
          importMetaURL,
          identity: defaultP?.identity || importMetaURL.split("/").pop() ||
            importMetaURL,
          version: defaultP?.version || "0.0.0",
          humanReadableSource: defaultP?.humanReadableSource || hrSrcSupplier,
          indent: (text) => {
            return text.replace(/^/gm, "    ");
          },
          unindent: (text) => {
            return tw.unindentWhitespace(text);
          },
        };
      return {
        provenance,
      };
    },
    prepareState: (
      ie: interp.InterpolationExecution,
      options: SQLa.InterpolationContextStateOptions = {
        schema: defaultSchema,
      },
    ): SQLa.DcpTemplateState => {
      const schema = options.schema || defaultSchema;
      const stateSearchPath = options.searchPath
        ? options.searchPath
        : [schema];
      if (options.extensions) {
        options.extensions.forEach((e) =>
          e.searchPath.forEach((p) => stateSearchPath.push(p))
        );
      }
      const dcpTS: SQLa.DcpTemplateState = {
        ic: dcpIC,
        ie,
        schema,
        isSchemaDefaulted: options.schema ? false : true,
        affinityGroup: options.affinityGroup ? options.affinityGroup : schema,
        searchPath: stateSearchPath,
        indentation: interp.isIndentable(ie.provenance)
          ? ie.provenance
          : interp.noIndentation,
        headers: typeof options.headers === "undefined"
          ? [
            tmpl.preface,
            tmpl.schema,
            tmpl.searchPath,
            tmpl.extensions,
          ]
          : (options.headers?.standalone || []),
        extensions: options.extensions,
        setSearchPathSql: (prepend?, append?) => {
          const include = (elements?: string | string[]): string[] => {
            return elements
              ? (Array.isArray(elements) ? elements : [elements])
              : [];
          };
          const sp: string[] = [
            ...include(prepend),
            ...stateSearchPath.map((s) => s.name),
            ...include(append),
          ];
          return `SET search_path TO ${[...new Set(sp)].join(", ")}`;
        },
      };
      return dcpTS;
    },
    embed: (
      ic: SQLa.DcpInterpolationContext,
      parent: SQLa.DcpTemplateState,
      irFn: (
        eic: SQLa.DcpEmbeddedInterpolationContext,
      ) => SQLa.DcpInterpolationResult,
    ): interp.InterpolatedContent => {
      const eic: SQLa.DcpEmbeddedInterpolationContext = {
        ...ic,
        parent,
        prepareState: (
          ie: interp.InterpolationExecution,
          options: SQLa.InterpolationContextStateOptions = {
            schema: defaultSchema,
          },
        ): SQLa.DcpTemplateState => {
          // an embedded template is basically the same as its parent except
          // it might have different headers
          const base = ic.prepareState(ie, options);
          return {
            ...base,
            headers: options?.headers?.embedded || [
              tmpl.embeddedPreface,
              tmpl.schema,
              tmpl.searchPath,
              tmpl.extensions,
            ],
          };
        },
      };
      const eir = irFn(eic);
      if (!SQLa.isDcpTemplateState(eir.state)) {
        throw Error(
          `embed(): eir.state is expected to be of type DcpTemplateState not ${typeof eir
            .state}`,
        );
      }
      // When embedding, we first add the indented headers expected then
      // unident the embedded interpolation result and finally indent it
      // at the parent's indentation level so that everything aligns
      const { state } = eir;
      return parent.indentation.indent(
        state.indentation.unindent(eir.interpolated),
      );
    },
  };
  return dcpIC;
}
