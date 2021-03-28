import * as mod from "../mod.ts";
import * as schemas from "../schemas.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "http_client_common",
);

export function SQL(
  ctx: mod.DcpInterpolationContext,
  options?: mod.InterpolationContextStateOptions,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.lib,
      affinityGroup,
      extensions: [schemas.pgCatalog.plPythonExtn],
    },
  );
  const { lcFunctions: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
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

    CREATE OR REPLACE FUNCTION ${
    fn.destroyIdempotent(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS http_client_fetch_content_text(text);
    END;$$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('http_client_fetch_content_text');    
    END;$$ LANGUAGE plpgsql;`;
}
