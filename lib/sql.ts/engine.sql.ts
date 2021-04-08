import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";
import * as tmpl from "../templates.ts";
import * as variant from "./variant.sql.ts";
import * as lifecycle from "./lifecycle.sql.ts";

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
        headers: { standalone: [tmpl.preface, tmpl.extensions] }, // skip schema and search path
        extensions: [
          schemas.extensions.pgTapExtn,
          schemas.extensions.pgStatStatementsExtn,
          schemas.extensions.ltreeExtn,
          schemas.extensions.semverExtn,
        ],
      },
    ),
  };
  const { qualifiedReference: lcqr } = schemas.lifecycle;
  const { lcFunctions: fn } = state.affinityGroup;
  // deno-fmt-ignore
  return mod.SQL(ctx, state)`
    ${schemas.context.createSchemaSql(state)};
    ${schemas.lib.createSchemaSql(state)};
    ${schemas.lifecycle.createSchemaSql(state)};
    ${schemas.confidential.createSchemaSql(state)};
    ${schemas.assurance.createSchemaSql(state)};
    ${schemas.experimental.createSchemaSql(state)};

    -- make sure everybody can use everything in the extensions schema
    grant usage on schema ${schemas.extensions.name} to public;
    grant execute on all functions in schema ${schemas.extensions.name} to public;

    -- include future extensions
    alter default privileges in schema ${schemas.extensions.name}
      grant execute on functions to public;

    alter default privileges in schema ${schemas.extensions.name}
      grant usage on types to public;

    CREATE OR REPLACE PROCEDURE ${fn.constructIdempotent(state).qName}() AS $$
    BEGIN
        CALL ${schemas.lifecycle.qualifiedReference("version_construct")}('${schemas.lifecycle.name}', 'asset_version', 'asset', NULL, '1.0.0'::semver);
        insert into asset_version (nature, asset, version) values ('storage', '${schemas.lifecycle.name}.asset_version_store', ${schemas.lifecycle.name}.asset_version_initial_revision());
        insert into asset_version (nature, asset, version) values ('storage', '${schemas.lifecycle.name}.asset_version_label_store', ${schemas.lifecycle.name}.asset_version_initial_revision());
        insert into asset_version (nature, asset, version) values ('storage', '${schemas.lifecycle.name}.asset_version_history', ${schemas.lifecycle.name}.asset_version_initial_revision());

        CALL ${lcqr("variant_construct")}('${schemas.lifecycle.name}', 'configuration', 'lifecycle', 'main');
        CALL ${lcqr("event_manager_construct")}('${schemas.lifecycle.name}', 'activity', 'event', 'lifecycle');
        
        CALL ${lcqr("variant_construct")}('${schemas.lib.name}','etc','config','project');
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        -- TODO: if user = 'dcp_destroyer' ... else raise exception invalid user trying to destroyIdempotent
      ${schemas.experimental.dropSchemaSql(state)};
      ${schemas.assurance.dropSchemaSql(state)};
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

${ctx.embed(ctx, state, (eic) => lifecycle.SQL(eic))}    
${ctx.embed(ctx, state, (eic) => variant.SQL(eic))}`;
}
