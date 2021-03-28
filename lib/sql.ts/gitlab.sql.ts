import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "gitlab",
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
        extensions: [schemas.extensions.httpExtn],
      },
  );
  const { qualifiedReference: cqr } = schemas.confidential;
  const { qualifiedReference: lcqr } = schemas.lifecycle;
  const { qualifiedReference: sqr } = state.schema;
  const { lcFunctions: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${fn.constructStorage(state).qName}() AS $$
    BEGIN
      CREATE TABLE IF NOT EXISTS ${cqr("gitlab_provenance")} (
        context ${lcqr("execution_context")} NOT NULL,
        api_base_url text NOT NULL,
        secret_authn_token text NOT NULL,
        authn_token_created_at timestamptz NOT NULL,
        authn_token_created_by text NOT NULL,
        authn_token_expires_at timestamptz NOT NULL,
        CONSTRAINT gitlab_provenance_unq_row UNIQUE(context)
      );
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.constructIdempotent(state).qName}() AS $$
    BEGIN
      ${state.setSearchPathSql()};

      CREATE OR REPLACE FUNCTION gitlab_project_asset_http_request(prov ${
    cqr("gitlab_provenance")
  }, project_id integer, asset_file_path text, branchOrTag text) returns http_request AS $innerFnBody$
      BEGIN
        ${state.setSearchPathSql()};
        return ('GET', format('%s/projects/%s/repository/files/%s?ref=%s', prov.api_base_url, project_id, asset_file_path, branchOrTag),
             ARRAY[http_header('PRIVATE-TOKEN', prov.secret_authn_token)], NULL, NULL)::http_request;
      END;
      $innerFnBody$ LANGUAGE PLPGSQL;

      CREATE OR REPLACE FUNCTION gitlab_project_commit_http_request(prov ${
    cqr("gitlab_provenance")
  }, project_id integer, commit_id text) returns http_request AS $innerFnBody$
      BEGIN
        ${state.setSearchPathSql()};
        return ('GET', format('%s/projects/%s/repository/commits/%s', prov.api_base_url, project_id, commit_id),
             ARRAY[http_header('PRIVATE-TOKEN', prov.secret_authn_token)], NULL, NULL)::http_request;
      END;
      $innerFnBody$ LANGUAGE PLPGSQL;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();        
        DROP FUNCTION IF EXISTS ${sqr("gitlab_project_asset_http_request")};
        DROP FUNCTION IF EXISTS ${sqr("gitlab_project_commit_http_request")};
        DROP TABLE IF EXISTS ${cqr("gitlab_provenance")};
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'gitlab_provenance');
    END;
    $$ LANGUAGE plpgsql;`;
}
