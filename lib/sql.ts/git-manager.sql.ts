import * as mod from "../mod.ts";

export async function SQL<C extends mod.InterpolationContext>(
  engine: mod.InterpolationEngine<C, mod.TemplateProvenance>,
): Promise<mod.InterpolationResult<C, mod.TemplateProvenance>> {
  const state = await mod.typicalState(engine, import.meta.url);
  const { schemaName: schema, functionName: fn } = engine.ctx;
  return mod.SQL(engine, state, { unindent: true })`
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

    CREATE OR REPLACE PROCEDURE ${fn.deploy.destroy("git_management")}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${schema.assurance}.test_git_management();
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_TEXT(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_JSON(TEXT, TEXT, INTEGER, TEXT);
        DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_XML(TEXT, TEXT, INTEGER, TEXT);
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${schema.assurance}.test_git_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('gitlab_project_asset_content_text');
        RETURN NEXT has_function('gitlab_project_asset_content_json');
        RETURN NEXT has_function('gitlab_project_asset_content_xml');
    END;
    $$;`;
}
