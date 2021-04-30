import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("postgraphile");

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
        extensions: [
          schemas.extensions.pgCryptoExtn,
          schemas.extensions.pgJwtExtn,
        ],
      },
  );
  const [lQR, exQR] = state.observableQR(
    schemas.lib,
    schemas.extensions,
  );
  const { lcFunctions: fn } = state.affinityGroup;
  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    -- We want all our object creations to be idempotent whenever possible
    DO $$
    BEGIN
      CREATE TYPE ${lQR("jwt_token_signed")} AS (token text);
      CREATE TYPE ${lQR("jwt_token_unsigned")} AS (
        role TEXT, --db role of the user
        exp INTEGER, --expiry date as the unix epoch
        user_id INTEGER, --db identifier of the user,
        username TEXT --username used to sign in, user's email in our case
      );
      comment on type jwt_token_unsigned IS 'User credentials Postgrest will use to create JWT for API authentication';
      EXCEPTION
        WHEN DUPLICATE_OBJECT THEN RAISE NOTICE 'type "jwt_token_unsigned" already exists, skipping';
    END $$;

    CREATE OR REPLACE FUNCTION ${lQR("authenticate_postgrest_pg_native")}(username text, password text) RETURNS TEXT LANGUAGE plpgsql STRICT SECURITY DEFINER AS $function$
    DECLARE
      jwt_token text,
      account pg_catalog.pg_authid;
      username_password text;
    BEGIN
      select a.* into account from pg_catalog.pg_authid as a where a.rolname = username;
      username_password := (select concat(password,username));
      IF account.rolname IS NOT NULL and account.rolpassword = concat('md5',md5(username_password)) THEN
        jwt_token:= ${exQR("sign")}(
          row_to_json(r), '${Deno.env.get("PGRST_JWT_SECRET")}'
        ) AS token
        FROM (SELECT 
          account.rolname,
          extract(epoch from now())::integer + 300 AS exp,
          account.oid,
          account.rolname
        ) r;
        return jwt_token;
      ELSE
        RETURN NULL;
      END IF;
    END;$function$;
    COMMENT ON FUNCTION authenticate_postgrest_pg_native("text","text") IS 'Authenticate a user and provide a Postgrest JWT payload';
    COMMENT ON FUNCTION authenticate_postgrest_pg_native(text, text) is E'@omit all';
    

    CREATE OR REPLACE FUNCTION ${fn.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
      RETURN NEXT has_extension('pgcrypto');
      RETURN NEXT has_type('jwt_token_postgrest');
      RETURN NEXT has_function('authenticate_postgrest_pg_native');
    END;$$ LANGUAGE plpgsql;  
  `;
}
