import * as mod from "../mod.ts";

export async function SQL<C extends mod.InterpolationContext>(
  engine: mod.InterpolationEngine<C>,
): Promise<mod.InterpolationResult<C, mod.TemplateProvenance>> {
  const state = await mod.typicalState(engine, import.meta.url);
  const { schemaName: schema, functionName: fn } = engine.ctx;
  return mod.SQL(engine, state, { unindent: true, includeFrontmatter: true })`
    -- TODO: add custom type for semantic version management
    -- TODO: add table to manage DCP functions/procs/versions for lifecycle management

    CREATE EXTENSION IF NOT EXISTS pgtap;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE EXTENSION IF NOT EXISTS ltree;
    CREATE SCHEMA IF NOT EXISTS ${schema.lifecycle};
    CREATE SCHEMA IF NOT EXISTS ${schema.assurance};
    CREATE SCHEMA IF NOT EXISTS ${schema.experimental};

    CREATE OR REPLACE PROCEDURE ${fn.deploy.construct("engine_common")}() AS $$
    BEGIN
        -- TODO: add anything that should be run after engine is constructed
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.deploy.destroy("engine_common")}() AS $$
    BEGIN
        DROP SCHEMA ${schema.assurance};
        DROP EXTENSION pgtap;
        DROP EXTENSION pg_stat_statements;
        DROP EXTENSION ltree;
    END;
    $$ LANGUAGE PLPGSQL;

    --
    -- source: https://stackoverflow.com/questions/7622908/drop-function-without-knowing-the-number-type-of-parameters
    --
    CREATE OR REPLACE FUNCTION ${
    fn.administrative("drop_all_functions_with_name")
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
    RETURN 'Dropped ' || numfunctions || ' functions';
    END;
    $$ LANGUAGE plpgsql VOLATILE COST 100;
    comment on ${
    fn.stateless("drop_all_functions_with_name")
  } drop_all_functions_with_name(TEXT) is 'Drop all overloaded functions with given function name';

    CREATE OR REPLACE FUNCTION ${schema.assurance}.test_engine_version() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT ok(pg_version_num() > 13000, 
                    format('PostgreSQL engine instance versions should be at least 13000 [%s]', pg_version()));
    END;
    $$;`;
}
