import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("federated");

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.lib,
        affinityGroup,
      },
  );
  const [cQR, ctxQR] = state.observableQR(
    schemas.confidential,
    schemas.context,
  );
  const { lcFunctions: fn } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${fn.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE TABLE IF NOT EXISTS ${cQR("fdw_postgres_authn")} (
        context ${ctxQR("execution_context")} NOT NULL,
        identity text NOT NULL,
        host text NOT NULL,
        port integer NOT NULL,
        dbname text NOT NULL,
        remote_schema text[] NOT NULL,
        local_schema text[] NOT NULL,
        server_name text NOT NULL,
        fetch_size integer DEFAULT 50,
        user_name text NOT NULL,
        password_clear text NOT NULL,
        prepare_function_name text DEFAULT NULL,
        purpose text NOT NULL,
        ssl_cert text NULL,
        ssl_key text NULL,
        ssl_ca text NULL,
        ssl_capath text NULL,
        -- TODO: add readonly, readwrite, etc. suggested permissions?
        CONSTRAINT fdw_postgres_authn_unq_row UNIQUE(context, identity)
      );
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
      DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();        
      DROP TABLE IF EXISTS ${cQR("fdw_postgres_authn")};
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${fn.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
      RETURN NEXT has_table('${schemas.confidential.name}', 'fdw_postgres_authn');
    END;
    $$ LANGUAGE plpgsql;`;
}
