import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("openproject");

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
        extensions: [schemas.extensions.ltreeExtn, schemas.extensions.httpExtn],
      },
  );
  const [sQR, cQR, exQR, ctxQR] = state.observableQR(
    state.schema,
    schemas.confidential,
    schemas.extensions,
    schemas.context,
  );
  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      BEGIN CREATE DOMAIN ${cQR("openproject_server_identity")} AS text;EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'domain "openproject_server_identity" already exists, skipping'; END;

      CREATE TABLE IF NOT EXISTS ${cQR("openproject_provenance")} (
        identity ${cQR("openproject_server_identity")} NOT NULL,
        context ${ctxQR("execution_context")} NOT NULL,
        api_base_url text NOT NULL,
        secret_authn_token text NOT NULL,
        authn_token_created_at timestamptz NOT NULL,
        authn_token_created_by text NOT NULL,
        authn_token_expires_at timestamptz NOT NULL,
        meta jsonb,
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        CONSTRAINT openproject_provenance_pk UNIQUE(identity),
        CONSTRAINT openproject_provenance_unq_row UNIQUE(identity, context)
      );    
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
        CREATE OR REPLACE FUNCTION ${sQR("openproject_asset_http_request")}(prov ${cQR("openproject_provenance")}, attachment_id integer) returns ${exQR("http_request")} AS $innerFnBody$
        BEGIN
            return ('GET', format('%s/attachments/%s/content', prov.api_base_url, attachment_id),
            ARRAY[${exQR("http_header")}('Authorization', concat('Basic ',prov.secret_authn_token))], NULL, NULL)::${exQR("http_request")};
        END;$innerFnBody$ LANGUAGE PLPGSQL;
        COMMENT ON FUNCTION ${sQR("openproject_asset_http_request")} (prov ${cQR("openproject_provenance")}, attachment_id integer) IS 'Given a openproject attachment id, fetch its content';
    END;$$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();        
        DROP FUNCTION IF EXISTS ${sQR("openproject_asset_http_request")};
        DROP TABLE IF EXISTS ${cQR("openproject_provenance")} CASCADE;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'openproject_provenance');
    END;
    $$ LANGUAGE plpgsql;`;
}
