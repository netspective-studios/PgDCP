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
        extensions: [
          schemas.extensions.httpExtn,
          schemas.pgCatalog.plPythonExtn,
        ],
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
        CONSTRAINT gitlab_provenance_unq_row UNIQUE(context, api_base_url, secret_authn_token)
      );
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.constructIdempotent(state).qName}() AS $$
    BEGIN
      ${state.setSearchPathSql()};
      -- CREATE OR REPLACE FUNCTION gitlab_project_asset_http_request(prov gitlab_provenance, project_id integer, asset_file_path text, branchOrTag text) returns http_request AS $innerFnBody$
      -- BEGIN
      --   ${state.setSearchPathSql()};
      --   return ('GET', format('%s/projects/%s/repository/files/%s?ref=%s', prov.api_base_url, project_id, asset_file_path, branchOrTag),
      --        ARRAY[http_header('PRIVATE-TOKEN',prov.secret_authn_token)], NULL, NULL)::http_request;
      -- END;
      -- $innerFnBody$ LANGUAGE PLPGSQL;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION gitlab_project_asset_content_text(gl_api_base_url text, gl_auth_token text, project_id integer, asset_file_name text) returns TEXT AS $$
    import urllib.request
    req = urllib.request.Request('{}/projects/{}/repository/files/{}/raw?ref=master'.format(gl_api_base_url, project_id, asset_file_name))
    req.add_header('PRIVATE-TOKEN', gl_auth_token)
    resp = urllib.request.urlopen(req)
    return resp.read().decode("utf-8")
    $$ LANGUAGE plpython3u;
    comment on function gitlab_project_asset_content_text(text, text, integer, text) is 'Retrieve a GitLab Project repo file as text';

    CREATE OR REPLACE FUNCTION gitlab_project_asset_content_json(gl_api_base_url text, gl_auth_token text, project_id integer, asset_file_name text) returns JSON AS $$
    import urllib.request, json
    req = urllib.request.Request('{}/projects/{}/repository/files/{}/raw?ref=master'.format(gl_api_base_url, project_id, asset_file_name))
    req.add_header('PRIVATE-TOKEN', gl_auth_token)
    resp = urllib.request.urlopen(req)
    return json.dumps(json.loads(resp.read().decode("utf-8")))
    $$ LANGUAGE plpython3u;
    comment on function gitlab_project_asset_content_json(text, text, integer, text) is 'Retrieve a GitLab Project repo file as JSON';

    CREATE OR REPLACE FUNCTION gitlab_project_asset_content_xml(gl_api_base_url text, gl_auth_token text, project_id integer, asset_file_name text) returns XML AS $$
    import urllib.request
    req = urllib.request.Request('{}/projects/{}/repository/files/{}/raw?ref=master'.format(gl_api_base_url, project_id, asset_file_name))
    req.add_header('PRIVATE-TOKEN', gl_auth_token)
    resp = urllib.request.urlopen(req)
    return resp.read().decode("utf-8")
    $$ LANGUAGE plpython3u;
    comment on function gitlab_project_asset_content_xml(text, text, integer, text) is 'Retrieve a GitLab Project repo file as XML';

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();        
        DROP FUNCTION ${
    sqr("gitlab_project_asset_content_text")
  }(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION ${
    sqr("gitlab_project_asset_content_json")
  }(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION ${
    sqr("gitlab_project_asset_content_xml")
  }(TEXT, TEXT, INTEGER, TEXT);
        DROP PROCEDURE IF EXISTS ${sqr("gitlab_project_asset_http_request")};
        DROP TABLE IF EXISTS ${sqr("gitlab_provenance")};        
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('gitlab_project_asset_content_text');
        RETURN NEXT has_function('gitlab_project_asset_content_json');
        RETURN NEXT has_function('gitlab_project_asset_content_xml');
    END;
    $$ LANGUAGE plpgsql;`;
}
