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

-- We want to use :'dcp_schema_assurance' inside the function body but $$...$$ is already interpolated
-- so we need to create a dynamic body first, assign it to a variable, then create the function from the 
-- variable. 
select format($$BEGIN
    DROP FUNCTION IF EXISTS %s.test_graphl_client();
    DROP FUNCTION IF EXISTS http_client_graphql_anonymous_query_result(text, text);
    DROP FUNCTION IF EXISTS http_client_graphql_authn_header_query_result(text, text, text, text);
END;$$, :'dcp_schema_assurance') as interpolated_fn_body \gset
CREATE OR REPLACE FUNCTION :dcp_schema_assurance.destroy_http_client_graphql() RETURNS SETOF TEXT AS
:'interpolated_fn_body'
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_http_client_graphql() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    RETURN NEXT has_function('http_client_graphql_anonymous_query_result');    
    RETURN NEXT has_function('http_client_graphql_authn_header_query_result');    
END;
$$;

