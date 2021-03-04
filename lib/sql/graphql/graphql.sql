CREATE EXTENSION IF NOT EXISTS plpython3u;

CREATE OR REPLACE FUNCTION graphql(base_url text, auth_token text, query text) returns JSON AS $$
import urllib.request, json
req = urllib.request.Request('{}/projects/{}/repository/files/{}/raw?ref=master'.format(base_url, project_id, asset_file_name))
--req.add_header('PRIVATE-TOKEN', auth_token)
resp = requests.post(url, json={'query': query})
--resp = urllib.request.urlopen(req)
return json.dumps(json.loads(resp.read().decode("utf-8")))
$$ LANGUAGE plpython3u;
comment on function graphql(base_url text, auth_token text, query text) is 'Retrieve a GitLab Project repo file as JSON';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_git_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    RETURN NEXT has_function('graphql');
    
END;
$$;

