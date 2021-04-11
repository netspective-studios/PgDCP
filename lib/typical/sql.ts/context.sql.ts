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
  const { qualifiedReference: exqr } = schemas.extensions;
  const { qualifiedReference: sqr } = state.schema;
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
    CREATE DOMAIN ${sqr("execution_context")} as ${exqr("ltree")};

    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE DOMAIN ${sqr("execution_host_identity")} as text;

      -- a single-row table which contains the global context (prod/test/devl/sandbox/etc.)
      CREATE TABLE ${sqr("context")} (
        singleton_id bool PRIMARY KEY DEFAULT TRUE,
        active ${sqr("execution_context")} NOT NULL,
        host ${sqr("execution_host_identity")} NOT NULL,
        CONSTRAINT context_unq CHECK (singleton_id)
      );

      -- TODO: add trigger to ensure that no improper values can be added into context
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
      CREATE OR REPLACE FUNCTION ${sqr("exec_context_production")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''production''::${sqr("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sqr("exec_context_test")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''test''::${sqr("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sqr("exec_context_devl")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''devl''::${sqr("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sqr("exec_context_sandbox")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''sandbox''::${sqr("execution_context")}';
      CREATE OR REPLACE FUNCTION ${sqr("exec_context_experimental")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''experimental''::${sqr("execution_context")}';

      CREATE OR REPLACE FUNCTION ${sqr("is_exec_context_production")}(ec ${sqr("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exqr("=")}) ${sqr("exec_context_production")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sqr("is_exec_context_test")}(ec ${sqr("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exqr("=")}) ${sqr("exec_context_test")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sqr("is_exec_context_devl")}(ec ${sqr("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exqr("=")}) ${sqr("exec_context_devl")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sqr("is_exec_context_sandbox")}(ec ${sqr("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exqr("=")}) ${sqr("exec_context_sandbox")}() THEN true else false end';
      CREATE OR REPLACE FUNCTION ${sqr("is_exec_context_experimental")}(ec ${sqr("execution_context")}) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN $1 OPERATOR(${exqr("=")}) ${sqr("exec_context_experimental")}() THEN true else false end';

      CREATE OR REPLACE FUNCTION ${sqr("is_active_context_production")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exqr("=")}) ${sqr("exec_context_production")}() THEN true else false end from ${sqr("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sqr("is_active_context_test")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exqr("=")}) ${sqr("exec_context_test")}() THEN true else false end from ${sqr("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sqr("is_active_context_devl")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exqr("=")}) ${sqr("exec_context_devl")}() THEN true else false end from ${sqr("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sqr("is_active_context_sandbox")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exqr("=")}) ${sqr("exec_context_sandbox")}() THEN true else false end from ${sqr("context")} where singleton_id = true';
      CREATE OR REPLACE FUNCTION ${sqr("is_active_context_experimental")}() RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT CASE WHEN active OPERATOR(${exqr("=")}) ${sqr("exec_context_experimental")}() THEN true else false end from ${sqr("context")} where singleton_id = true';
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_experimental")}();
        DROP FUNCTION IF EXISTS ${sqr("is_exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sqr("is_exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sqr("is_exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sqr("is_exec_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sqr("is_exec_context_experimental")}();
        DROP FUNCTION IF EXISTS ${sqr("is_active_context_production")}();
        DROP FUNCTION IF EXISTS ${sqr("is_active_context_test")}();
        DROP FUNCTION IF EXISTS ${sqr("is_active_context_devl")}();
        DROP FUNCTION IF EXISTS ${sqr("is_active_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sqr("is_active_context_experimental")}();
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
