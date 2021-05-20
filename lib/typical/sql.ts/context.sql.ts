import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.context,
      extensions: [schemas.extensions.ltreeExtn],
    },
  );
  const [exQR, sQR] = state.observableQR(schemas.extensions, state.schema);
  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`  
    ${schemas.lifecycle.createSchemaSql(state)};
    ${schemas.lib.createSchemaSql(state)};
    ${schemas.confidential.createSchemaSql(state)};
    ${schemas.assurance.createSchemaSql(state)};
    ${schemas.experimental.createSchemaSql(state)};

    -- TODO: this should be created in ${lcf.constructStorage(state).qName}() but 
    --       there are some dependents don't wait for it to be called so we create 
    --       it here
    -- TODO: Add CHECK constraint to make sure execution_context can only have
    --       valid values
    DO $$
    BEGIN
      CREATE DOMAIN ${sQR("execution_context")} as ${exQR("ltree")};
    EXCEPTION
        WHEN DUPLICATE_OBJECT THEN
            RAISE NOTICE 'domain "execution_context" already exists, skipping';
    END
    $$;

    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
     BEGIN CREATE DOMAIN ${sQR("execution_host_identity")} as text;EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'domain "execution_host_identity" already exists, skipping'; END;

      -- a single-row table which contains the global context (prod/test/devl/sandbox/etc.)
      CREATE TABLE IF NOT EXISTS ${sQR("context")} (
        singleton_id bool PRIMARY KEY DEFAULT TRUE,
        active ${sQR("execution_context")} NOT NULL,
        host ${sQR("execution_host_identity")} NOT NULL,
        CONSTRAINT context_unq CHECK (singleton_id)
      );

      -- TODO: add trigger to ensure that no improper values can be added into context
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
      CREATE OR REPLACE FUNCTION ${sQR("exec_context_production")}() RETURNS ${sQR("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''production''::${sQR("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sQR("exec_context_test")}() RETURNS ${sQR("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''test''::${sQR("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sQR("exec_context_devl")}() RETURNS ${sQR("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''devl''::${sQR("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sQR("exec_context_sandbox")}() RETURNS ${sQR("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''sandbox''::${sQR("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sQR("exec_context_experimental")}() RETURNS ${sQR("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''experimental''::${sQR("execution_context")}';

      CREATE OR REPLACE FUNCTION ${sQR("is_exec_context_production")}(ec ${sQR("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exQR("=")}) ${sQR("exec_context_production")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sQR("is_exec_context_test")}(ec ${sQR("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exQR("=")}) ${sQR("exec_context_test")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sQR("is_exec_context_devl")}(ec ${sQR("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exQR("=")}) ${sQR("exec_context_devl")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sQR("is_exec_context_sandbox")}(ec ${sQR("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exQR("=")}) ${sQR("exec_context_sandbox")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sQR("is_exec_context_experimental")}(ec ${sQR("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exQR("=")}) ${sQR("exec_context_experimental")}() THEN true else false end';

      CREATE OR REPLACE FUNCTION ${sQR("is_active_context_production")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exQR("=")}) ${sQR("exec_context_production")}() THEN true else false end from ${sQR("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sQR("is_active_context_test")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exQR("=")}) ${sQR("exec_context_test")}() THEN true else false end from ${sQR("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sQR("is_active_context_devl")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exQR("=")}) ${sQR("exec_context_devl")}() THEN true else false end from ${sQR("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sQR("is_active_context_sandbox")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exQR("=")}) ${sQR("exec_context_sandbox")}() THEN true else false end from ${sQR("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sQR("is_active_context_experimental")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exQR("=")}) ${sQR("exec_context_experimental")}() THEN true else false end from ${sQR("context")} where singleton_id = true';
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS ${sQR("exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sQR("exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sQR("exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sQR("exec_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sQR("exec_context_experimental")}();
        DROP FUNCTION IF EXISTS ${sQR("is_exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sQR("is_exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sQR("is_exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sQR("is_exec_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sQR("is_exec_context_experimental")}();
        DROP FUNCTION IF EXISTS ${sQR("is_active_context_production")}();
        DROP FUNCTION IF EXISTS ${sQR("is_active_context_test")}();
        DROP FUNCTION IF EXISTS ${sQR("is_active_context_devl")}();
        DROP FUNCTION IF EXISTS ${sQR("is_active_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sQR("is_active_context_experimental")}();
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_production');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_test');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_devl');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_sandbox');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_experimental');
        RETURN NEXT has_function('${state.schema.name}', 'is_exec_context_production');
        RETURN NEXT has_function('${state.schema.name}', 'is_exec_context_test');
        RETURN NEXT has_function('${state.schema.name}', 'is_exec_context_devl');
        RETURN NEXT has_function('${state.schema.name}', 'is_exec_context_sandbox');
        RETURN NEXT has_function('${state.schema.name}', 'is_exec_context_experimental');
        RETURN NEXT has_function('${state.schema.name}', 'is_active_context_production');
        RETURN NEXT has_function('${state.schema.name}', 'is_active_context_test');
        RETURN NEXT has_function('${state.schema.name}', 'is_active_context_devl');
        RETURN NEXT has_function('${state.schema.name}', 'is_active_context_sandbox');
        RETURN NEXT has_function('${state.schema.name}', 'is_active_context_experimental');
    END;
    $$;`;
}
