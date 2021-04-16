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
        extensions: [schemas.extensions.pgCryptoExtn],
      },
  );
  const [lQR] = state.observableQR(schemas.lib);
  const { lcFunctions: fn } = state.affinityGroup;
  return SQLa.SQL(ctx, state)`
    -- We want all our object creations to be idempotent whenever possible
    DO $$
    BEGIN
        CREATE TYPE jwt_token_postgraphile AS (
            role TEXT, --db role of the user
            exp INTEGER, --expiry date as the unix epoch
            user_id INTEGER, --db identifier of the user,
            username TEXT --username used to sign in, user's email in our case
        );
        comment on type jwt_token_postgraphile IS 'User credentials Postgraphile will use to create JWT for API authentication';
    EXCEPTION
        WHEN DUPLICATE_OBJECT THEN
            RAISE NOTICE 'type "jwt_token_postgraphile" already exists, skipping';
    END
    $$;

    CREATE OR REPLACE FUNCTION authenticate_postgraphile_pg_native(username text, password text)
    RETURNS jwt_token_postgraphile
    LANGUAGE plpgsql
    STRICT SECURITY DEFINER
    AS $function$
    DECLARE
        account pg_catalog.pg_authid;
        username_password text;
    BEGIN
        select a.* into account
          from pg_catalog.pg_authid as a
         where a.rolname = username;
       
        username_password := (select concat(password,username));
        
        IF account.rolname IS NOT NULL and account.rolpassword = concat('md5',md5(username_password)) THEN
        RETURN (
          account.rolname,
          extract(epoch from now() + interval '7 days'),
          account.oid,
          account.rolname
        )::${lQR("jwt_token_postgraphile")};
        ELSE
        RETURN NULL;
        END IF;
    END;
    $function$
    ;

    COMMENT ON FUNCTION authenticate_postgraphile_pg_native("text","text") IS 'Authenticate a user and provide a Postgraphile JWT payload';

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('pgcrypto');
        RETURN NEXT has_type('jwt_token_postgraphile');
        RETURN NEXT has_function('authenticate_postgraphile_pg_native');
    END;
    $$ LANGUAGE plpgsql;  
`;
}
