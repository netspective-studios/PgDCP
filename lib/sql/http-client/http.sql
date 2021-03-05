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
req = urllib.request.Request(text)
resp = urllib.request.urlopen(req)
return resp.read().decode("utf-8")
$$ LANGUAGE plpython3u;
comment on function http_client_fetch_content_text(text) is 'Retrieve a URL endpoint payload as text';

-- We want to use :'dcp_schema_assurance' inside the function body but $$...$$ is already interpolated
-- so we need to create a dynamic body first, assign it to a variable, then create the function from the 
-- variable. 
select format($$BEGIN
    DROP FUNCTION IF EXISTS %s.test_http_client();
    DROP FUNCTION IF EXISTS http_client_fetch_content_text(text);
END;$$, :'dcp_schema_assurance') as interpolated_fn_body \gset
CREATE OR REPLACE FUNCTION :dcp_schema_assurance.destroy_http_client_graphql() RETURNS SETOF TEXT AS
:'interpolated_fn_body'
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_http_client() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    RETURN NEXT has_function('http_client_fetch_content_text');    
END;
$$;
