import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("gitlab");

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
  const { qualifiedReference: sqr } = state.schema;
  const { qualifiedReference: cqr } = schemas.confidential;
  const { qualifiedReference: exqr } = schemas.extensions;
  const { qualifiedReference: ctxqr } = schemas.context;
  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE DOMAIN ${cqr("gitlab_server_identity")} AS text;

      CREATE TABLE IF NOT EXISTS ${cqr("gitlab_provenance")} (
        identity ${cqr("gitlab_server_identity")} NOT NULL,
        context ${ctxqr("execution_context")} NOT NULL,
        api_base_url text NOT NULL,
        secret_authn_token text NOT NULL,
        authn_token_created_at timestamptz NOT NULL,
        authn_token_created_by text NOT NULL,
        authn_token_expires_at timestamptz NOT NULL,
        meta jsonb,
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        CONSTRAINT gitlab_provenance_pk UNIQUE(identity),
        CONSTRAINT gitlab_provenance_unq_row UNIQUE(identity, context)
      );    
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
      CREATE OR REPLACE FUNCTION ${sqr("gitlab_project_asset_http_request")}(prov ${cqr("gitlab_provenance")}, project_id integer, asset_file_path text, branchOrTag text) returns ${exqr("http_request")} AS $innerFnBody$
      BEGIN
        return ('GET', format('%s/projects/%s/repository/files/%s?ref=%s', prov.api_base_url, project_id, asset_file_path, branchOrTag),
             ARRAY[${exqr("http_header")}('PRIVATE-TOKEN', prov.secret_authn_token)], NULL, NULL)::${exqr("http_request")};
      END;
      $innerFnBody$ LANGUAGE PLPGSQL;

      CREATE OR REPLACE FUNCTION ${sqr("gitlab_project_commit_http_request")}(prov ${cqr("gitlab_provenance")}, project_id integer, commit_id text) returns ${exqr("http_request")} AS $innerFnBody$
      BEGIN
        return ('GET', format('%s/projects/%s/repository/commits/%s', prov.api_base_url, project_id, commit_id),
             ARRAY[${exqr("http_header")}('PRIVATE-TOKEN', prov.secret_authn_token)], NULL, NULL)::${exqr("http_request")};
      END;
      $innerFnBody$ LANGUAGE PLPGSQL;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();        
        DROP FUNCTION IF EXISTS ${sqr("gitlab_project_asset_http_request")};
        DROP FUNCTION IF EXISTS ${sqr("gitlab_project_commit_http_request")};
        DROP TABLE IF EXISTS ${cqr("gitlab_provenance")} CASCADE;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'gitlab_provenance');
    END;
    $$ LANGUAGE plpgsql;`;
}
