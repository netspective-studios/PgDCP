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
    options || { schema: schemas.lib, affinityGroup },
  );
  const { lcFunctions: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
    CREATE EXTENSION IF NOT EXISTS plpython3u;

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

    CREATE OR REPLACE PROCEDURE ${fn.destroy(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_TEXT(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_JSON(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_XML(TEXT, TEXT, INTEGER, TEXT);
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
