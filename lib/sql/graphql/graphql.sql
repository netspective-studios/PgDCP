CREATE EXTENSION IF NOT EXISTS plpython3u;

--TODO -Need to check - Getting an error -SQL Error [38000]: ERROR: urllib.error.HTTPError: HTTP Error 500: Internal Server Error
CREATE OR REPLACE FUNCTION graphql(base_url text, auth_token text, query text) RETURNS JSON AS $$
import ssl,urllib.request, json
headers = {
  'Content-Type': 'application/json'
}
ctx = ssl.SSLContext(ssl.PROTOCOL_SSLv23)
data = query.encode('utf-8')
req =  urllib.request.Request(base_url, data=data)
resp = urllib.request.urlopen(req,context=ctx)
return json.dumps(json.loads(resp.read().decode("utf-8")))
$$ LANGUAGE plpython3u;
COMMENT ON FUNCTION graphql(base_url text, auth_token text, query text) is 'Retrieves data as a JSON from a given graphql end point';

--TODO : this select query should be called from the content-assembly. Example:
--select from graphql('https://service.ontology.attest.cloud/','','{\"query\":\"{\\r\\n  getClassHierarchy(rootClassName: \\\"Collection\\\", searchParam: \\\"\\\") {\\r\\n    classname\\r\\n    label\\r\\n    parentclasslabel\\r\\n    parentclassname\\r\\n  }\\r\\n}\",\"variables\":{}}');


CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_git_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    RETURN NEXT has_function('graphql');
    
END;
$$;


-- CREATE OR REPLACE FUNCTION graphql(base_url text, auth_token text, query text) returns JSON AS $$
-- import httplib,urllib.request, json
-- url = "https://service.ontology.attest.cloud/"
-- data="{\"query\":\"{\\r\\n  getClassHierarchy(rootClassName: \\\"Collection\\\", searchParam: \\\"\\\") {\\r\\n    classname\\r\\n    label\\r\\n    parentclasslabel\\r\\n    parentclassname\\r\\n  }\\r\\n}\",\"variables\":{}}"
-- headers = {
--   'Content-Type': 'application/json'
-- }
-- data = data.encode('utf-8')
-- conn = httplib.HTTPSConnection(url)
-- conn.request("POST", url, data, headers)
-- resp = conn.getresponse()
-- return json.dumps(json.loads(resp.read().decode("utf-8")))
-- $$ LANGUAGE plpython3u;
-- comment on function graphql(base_url text, auth_token text, query text) is 'Retrieve a GitLab Project repo file as JSON';



