import * as mod from "../mod.ts";

export function SQL(
  ctx: mod.DcpInterpolationContext,
): mod.InterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    { schema: ctx.sql.schemas.lib, affinityGroup: "http_client_common" },
  );
  const { functionNames: fn } = state.affinityGroup;
  return mod.SQL(ctx.engine, state)`
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

    CREATE OR REPLACE FUNCTION ${fn.destroy(ctx)}() RETURNS SETOF TEXT AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(ctx)}();
        DROP FUNCTION IF EXISTS http_client_fetch_content_text(text);
    END;$$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION ${fn.unitTest(ctx)}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('http_client_fetch_content_text');    
    END;$$ LANGUAGE plpgsql;`;
}
