import * as mod from "../mod.ts";

export function SQL(
  ctx: mod.DcpInterpolationContext,
): mod.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    { schema: ctx.sql.schemas.lib, affinityGroup: "http_client_graphql" },
  );
  const { functionNames: fn } = state.affinityGroup;
  return mod.SQL(ctx, state)`
    CREATE EXTENSION IF NOT EXISTS plpython3u;

    CREATE OR REPLACE FUNCTION http_client_graphql_anonymous_query_result(endpoint_url text, query text) returns JSON AS $$
    import urllib.request, json
    req = urllib.request.Request(endpoint_url)
    req.add_header('Content-Type', 'application/json')
    resp = urllib.request.urlopen(req, data=json.dumps({'query': query}).encode())
    return json.dumps(json.loads(resp.read().decode("utf-8")))
    $$ LANGUAGE plpython3u;
    comment on function http_client_graphql_anonymous_query_result(text, text) is 'Execute a GraphQL query that does not require authentication and return result as JSON';

    CREATE OR REPLACE FUNCTION http_client_graphql_authn_header_query_result(endpoint_url text, auth_token_header_name text, auth_token text, query text) returns JSON AS $$
    import urllib.request, json
    req = urllib.request.Request(endpoint_url)
    req.add_header('Content-Type', 'application/json')
    req.add_header(auth_token_header_name, auth_token)
    resp = urllib.request.urlopen(req, data=json.dumps({'query': query}).encode())
    return json.dumps(json.loads(resp.read().decode("utf-8")))
    $$ LANGUAGE plpython3u;
    comment on function http_client_graphql_authn_header_query_result(text, text, text, text) is 'Execute a GraphQL query that requires authentication header and return result as JSON';

    CREATE OR REPLACE PROCEDURE ${fn.destroy(ctx)}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(ctx)}();
        DROP FUNCTION IF EXISTS http_client_graphql_anonymous_query_result(text, text);
        DROP FUNCTION IF EXISTS http_client_graphql_authn_header_query_result(text, text, text, text);
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${fn.unitTest(ctx)}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('http_client_graphql_anonymous_query_result');    
        RETURN NEXT has_function('http_client_graphql_authn_header_query_result');    
    END;
    $$ LANGUAGE plpgsql;`;
}
