import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "http_client_graphql",
);

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
        extensions: [schemas.pgCatalog.plPythonExtn],
      },
  );
  const { lcFunctions: fn } = state.affinityGroup;
  return SQLa.SQL(ctx, state)`
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

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS http_client_graphql_anonymous_query_result(text, text);
        DROP FUNCTION IF EXISTS http_client_graphql_authn_header_query_result(text, text, text, text);
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_extension('plpython3u');
        RETURN NEXT has_function('http_client_graphql_anonymous_query_result');    
        RETURN NEXT has_function('http_client_graphql_authn_header_query_result');    
    END;
    $$ LANGUAGE plpgsql;`;
}
