import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.lib,
      extensions: [schemas.extensions.ltreeExtn],
    },
  );
  const { qualifiedReference: sqr } = state.schema;
  const { qualifiedReference: exqr } = schemas.extensions;
  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return mod.SQL(ctx, state)`  
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE DOMAIN ${sqr("observations")} as jsonb;
      CREATE DOMAIN ${sqr("obs_record_state")} as ${exqr("ltree")};

      CREATE DOMAIN ${sqr("obs_metric_name")} as text;
      CREATE DOMAIN ${sqr("obs_metric_label")} as text;
      CREATE DOMAIN ${sqr("obs_metric_value")} as text;

      CREATE DOMAIN ${sqr("obs_span_name")} as text;
      CREATE DOMAIN ${sqr("obs_span_id")} as text;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
      CREATE OR REPLACE FUNCTION ${sqr("obs_record_state_active")}() RETURNS ${sqr("obs_record_state")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''active''::${sqr("obs_record_state")}';
      CREATE OR REPLACE FUNCTION ${sqr("obs_record_state_deleted")}(pk integer) RETURNS ${sqr("obs_record_state")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$SELECT ('deleted.' || pk::text)::${sqr("obs_record_state")}$$;

      -- create or replace function observe_update(obs ${sqr("observations")}, old record, new record) returns ${sqr("observations")}
      -- create or replace function observe_delete(obs ${sqr("observations")}, old record, new record) returns [${sqr("obs_record_state")}, ${sqr("observations")}]
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
        DROP DOMAIN IF EXISTS ${sqr("obs_record_state")};
        DROP DOMAIN IF EXISTS ${sqr("obs_metric_name")};
        DROP DOMAIN IF EXISTS ${sqr("obs_metric_label")};
        DROP DOMAIN IF EXISTS ${sqr("obs_metric_value")};
        DROP DOMAIN IF EXISTS ${sqr("obs_span_name")};
        DROP DOMAIN IF EXISTS ${sqr("obs_span_id")};
        DROP FUNCTION IF EXISTS ${sqr("obs_record_state_active")}();
        DROP FUNCTION IF EXISTS ${sqr("obs_record_state_deleted")}();
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_domain('${state.schema.name}', 'obs_record_state');
        RETURN NEXT has_domain('${state.schema.name}', 'obs_metric_name');
        RETURN NEXT has_domain('${state.schema.name}', 'obs_metric_label');
        RETURN NEXT has_domain('${state.schema.name}', 'obs_metric_value');
        RETURN NEXT has_domain('${state.schema.name}', 'obs_span_name');
        RETURN NEXT has_domain('${state.schema.name}', 'obs_span_id');
        RETURN NEXT has_function('${state.schema.name}', 'obs_record_state_active');
        RETURN NEXT has_function('${state.schema.name}', 'obs_record_state_deleted');
    END;
    $$;`;
}
