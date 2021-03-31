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
  const { qualifiedReference: eqr } = schemas.extensions;
  const { qualifiedReference: sqr } = state.schema;
  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return mod.SQL(ctx, state)`  
    CREATE DOMAIN ${sqr("execution_context")} as ${eqr("ltree")};

    CREATE OR REPLACE FUNCTION ${sqr("exec_context_production")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''production''::${sqr("execution_context")}';
    CREATE OR REPLACE FUNCTION ${sqr("exec_context_test")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''test''::${sqr("execution_context")}';
    CREATE OR REPLACE FUNCTION ${sqr("exec_context_devl")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''devl''::${sqr("execution_context")}';
    CREATE OR REPLACE FUNCTION ${sqr("exec_context_sandbox")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''sandbox''::${sqr("execution_context")}';
    CREATE OR REPLACE FUNCTION ${sqr("exec_context_experimental")}() RETURNS ${sqr("execution_context")} LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''experimental''::${sqr("execution_context")}';

    -- TODO: create is_exec_context_production(execution_context) and is_exec_context_experimental(execution_context)

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_production")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_test")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_devl")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_sandbox")}();
        DROP FUNCTION IF EXISTS ${sqr("exec_context_experimental")}();
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_production');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_test');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_devl');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_sandbox');
        RETURN NEXT has_function('${state.schema.name}', 'exec_context_experimental');
    END;
    $$;`;
}
