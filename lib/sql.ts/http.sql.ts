import * as mod from "../mod.ts";

export async function SQL<C extends mod.InterpolationContext>(
  engine: mod.InterpolationEngine<C>,
): Promise<mod.InterpolationResult<C, mod.TemplateProvenance>> {
  const state = await mod.typicalState(engine, import.meta.url);
  const { schemaName: schema, functionName: fn } = engine.ctx;
  return mod.SQL(engine, state, { unindent: true, includeFrontmatter: true })`
    CREATE EXTENSION IF NOT EXISTS plpython3u;

    -- TODO: create a custom HTTP Client result which would give back a complete, 
    -- structured, response
    -- CREATE TYPE http_client_fetch_result AS (
    --     endpoint_url TEXT,
    --     mime_type text,
    --     content TEXT,
    --     ...etc.
    -- );
    --
    -- CREATE OR REPLACE FUNCTION http_client_fetch(endpoint_url text) returns http_client_fetch_result AS $$
    -- import urllib.request
    -- req = urllib.request.Request(text)
    -- resp = urllib.request.urlopen(req)
    -- return endpoint_url, resp.read().decode("utf-8")
    -- $$ LANGUAGE plpython3u;
    -- comment on function http_client_fetch(text) is 'Retrieve a URL endpoint payload as text';

    CREATE OR REPLACE FUNCTION http_client_fetch_content_text(endpoint_url text) returns TEXT AS $$
    import urllib.request
    req = urllib.request.Request(endpoint_url)
    resp = urllib.request.urlopen(req)
    return resp.read().decode("utf-8")
    $$ LANGUAGE plpython3u;
    comment on function http_client_fetch_content_text(text) is 'Retrieve a URL endpoint payload as text';

    CREATE OR REPLACE FUNCTION ${schema.lifecycle}.destroy_http_client_graphql() RETURNS SETOF TEXT AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${schema.assurance}.test_http_client();
        DROP FUNCTION IF EXISTS http_client_fetch_content_text(text);
    END;$$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION ${schema.assurance}.test_http_client() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('http_client_fetch_content_text');    
    END;$$ LANGUAGE plpgsql;`;
}
