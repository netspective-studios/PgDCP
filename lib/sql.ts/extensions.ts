import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.lifecycle,
      extensions: [schemas.extensions.ltreeExtn],
    },
  );
  const { qualifiedReference: sqr } = state.schema;
  const { lcFunctions: lcf } = state.affinityGroup;
  return mod.SQL(ctx, state)`  
    CREATE DOMAIN ${sqr("execution_context")} as ltree;

    CREATE OR REPLACE FUNCTION ${sqr("exec_context_production")}() RETURNS ${
    sqr("execution_context")
  } LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''production''::ltree';

    CREATE OR REPLACE FUNCTION ${sqr("exec_context_test")}() RETURNS ${
    sqr("execution_context")
  } LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''test''::ltree';

    CREATE OR REPLACE FUNCTION ${sqr("exec_context_devl")}() RETURNS ${
    sqr("execution_context")
  } LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''devl''::ltree';

    CREATE OR REPLACE FUNCTION ${sqr("exec_context_sandbox")}() RETURNS ${
    sqr("execution_context")
  } LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''sandbox''::ltree';

    -- TODO: create is_exec_context_production(execution_context) and is_exec_context_experimental(execution_context)

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_sandbox")}();
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE FUNCTION ${
    lcf.unitTest(state).qName
  }() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_production');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_test');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_devl');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_sandbox');
    END;
    $$;`;
}
