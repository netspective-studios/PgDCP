import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";
import * as tmpl from "../templates.ts";
import * as variant from "./variant.sql.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "engine",
);

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = {
    ...ctx.prepareState(
      ctx.prepareTsModuleExecution(import.meta.url),
      options || {
        affinityGroup,
        headers: { standalone: [tmpl.preface] }, // skip schema and search path
      },
    ),
  };
  const { lcFunctions: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
    -- TODO: add custom type for semantic version management
    -- TODO: add table to manage DCP functionNames/procs/versions for lifecycle management

    CREATE EXTENSION IF NOT EXISTS pgtap;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE EXTENSION IF NOT EXISTS ltree;
    ${schemas.lifecycle.createSchemaSql(state)};
    ${schemas.assurance.createSchemaSql(state)};
    ${schemas.experimental.createSchemaSql(state)};
    ${schemas.lib.createSchemaSql(state)};

    -- TODO: add, to all *_construct() and *_destroy() functionNames the requirement that
    --       all activities are logged into a lifecycle table
    CREATE OR REPLACE PROCEDURE ${fn.construct(state).qName}() AS $$
    BEGIN
        ${schemas.assurance.createSchemaSql(state)};
        ${schemas.experimental.createSchemaSql(state)};
        ${schemas.lib.createSchemaSql(state)};
        CALL ${
    schemas.lifecycle.qualifiedReference("variant_construct")
  }('${schemas.lifecycle.name}', 'configuration', 'lifecycle', 'main');
        CALL ${
    schemas.lifecycle.qualifiedReference("event_manager_construct")
  }('${schemas.lifecycle.name}', 'activity', 'lifecycle');
    END;
    $$ LANGUAGE PLPGSQL;

    -- TODO: add, to all *_destroy() functionNames the requirement that it be a specific
    --       user that is calling the destruction (e.g. "dcp_destroyer") and that
    --       user is highly restricted.
    CREATE OR REPLACE PROCEDURE ${fn.destroy(state).qName}() AS $$
    BEGIN
        -- TODO: if user = 'dcp_destroyer' ... else raise exception invalid user trying to destroy
        ${schemas.assurance.dropSchemaSql(state)};
        ${schemas.experimental.dropSchemaSql(state)};
        ${schemas.lib.dropSchemaSql(state)};
        call variant_dcp_lifecycle_etc_destroy_all_objects();
    END;
    $$ LANGUAGE PLPGSQL;

    --
    -- source: https://stackoverflow.com/questions/7622908/drop-function-without-knowing-the-number-type-of-parameters
    --
    CREATE OR REPLACE FUNCTION ${
    schemas.lifecycle.qualifiedReference("drop_all_functions_with_name")
  }(function_name text) RETURNS text AS $$
    DECLARE
        funcrow RECORD;
        numfunctions smallint := 0;
        numparameters int;
        i int;
        paramtext text;
    BEGIN
        FOR funcrow IN SELECT proargtypes FROM pg_proc WHERE proname = function_name LOOP
            --for some reason array_upper is off by one for the oidvector type, hence the +1
            numparameters = array_upper(funcrow.proargtypes, 1) + 1;

            i = 0;
            paramtext = '';

            LOOP
                IF i < numparameters THEN
                    IF i > 0 THEN
                        paramtext = paramtext || ', ';
                    END IF;
                    paramtext = paramtext || (SELECT typname FROM pg_type WHERE oid = funcrow.proargtypes[i]);
                    i = i + 1;
                ELSE
                    EXIT;
                END IF;
            END LOOP;

            EXECUTE 'DROP FUNCTION ' || function_name || '(' || paramtext || ');';
            numfunctions = numfunctions + 1;

        END LOOP;
    RETURN 'Dropped ' || numfunctions || ' functionNames';
    END;
    $$ LANGUAGE plpgsql VOLATILE COST 100;

    CREATE OR REPLACE FUNCTION ${
    schemas.lifecycle.qualifiedReference("test_engine_version")
  }() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT ok(pg_version_num() > 13000, 
                    format('PostgreSQL engine instance versions should be at least 13000 [%s]', pg_version()));
    END;$$;
    
${ctx.embed(ctx, state, (eic) => variant.SQL(eic))}`;
}
