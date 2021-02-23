supplyRecipeJustFile := "../recipe-suppliers.justfile"
emitRecipeCmd := "../emit-recipe-content.pl"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

psql-init-engine-instance:
    #!/usr/bin/env {{emitRecipeCmd}}
    CREATE EXTENSION IF NOT EXISTS pgtap;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE SCHEMA IF NOT EXISTS :schema_assurance;

psql-assurance-engine-version expectMinVersion testFnName="test_engine_version":
    #!/usr/bin/env {{emitRecipeCmd}}
    CREATE OR REPLACE FUNCTION :schema_assurance.{{testFnName}}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT ok(pg_version_num() > {{expectMinVersion}}, 
                       format('PostgreSQL engine instance versions should be at least {{expectMinVersion}} [%s]', pg_version()));
    END;
    $$;
