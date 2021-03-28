import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "federated",
);

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.lib,
        affinityGroup,
      },
  );
  const { qualifiedReference: cqr } = schemas.confidential;
  const { qualifiedReference: lcqr } = schemas.lifecycle;
  const { lcFunctions: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${fn.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE TABLE IF NOT EXISTS ${cqr("fdw_postgres_authn")} (
        context ${lcqr("execution_context")} NOT NULL,
        identity text NOT NULL,
        user_name text NOT NULL,
        password_clear text NOT NULL,
        purpose text NOT NULL,
        -- TODO: add readonly, readwrite, etc. suggested permissions?
        CONSTRAINT fdw_postgres_authn_unq_row UNIQUE(context, identity)
      );
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();        
        DROP TABLE IF EXISTS ${cqr("fdw_postgres_authn")};
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'fdw_postgres_authn');
    END;
    $$ LANGUAGE plpgsql;`;
}
