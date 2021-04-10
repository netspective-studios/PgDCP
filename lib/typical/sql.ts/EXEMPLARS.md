# PgDCP Exemplars and Samples

This document contains examples of how to do common 

## HTTP client processing if pg_http extension is not getting the job done

Typically we want to use the `pg_http` extension which is a nice type-safe wrapper around CURL that can be used in almost any normal SQL code. However, sometimes we might want to do some more complex processing so the following are examples of PL/Python wrappers.

```python
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
```