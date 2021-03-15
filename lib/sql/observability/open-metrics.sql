CREATE EXTENSION IF NOT EXISTS plpython3u;

-- https://github.com/free/sql_exporter
-- https://github.com/justwatchcom/sql_exporter
-- https://pypi.org/project/query-exporter/

-- Create list of files to retrieve in Variant list (e.g. "xyz.sql"  in GitLab, which should be "subscribed" to and updated regularly)
-- Allow queries to be written in GitHub or GitLab, and automatically "pulled" into the tables here using a "sync" command
-- Allow queries to be written in GitHub or GitLab, and "pushed" into tables using CI/CD
-- Make it so that GitOps is the way to get things into the database in a revision controlled fashion
-- Incorporate technique to include version numbers in function results

-- Create service result type
--     normal typed result 
--     provenance (where it came from, e.g. GitHub, GitLab, repo)
--     version (what version it came from, e.g. tag/branch/etc.)

-- Create Metric type (Open Metric)
-- Create Metric_Query type (executable dynamic SQL or stored procedure)

-- metrics:
--   metric1:
--     type: gauge
--     description: A sample gaugeq
--   metric2:
--     type: summary
--     description: A sample summary
--     labels: [l1, l2]
--   metric3:
--     type: histogram
--     description: A sample histogram
--     buckets: [10, 20, 50, 100, 1000]
--   metric4:
--     type: enum
--     description: A sample enum
--     states: [foo, bar, baz]

-- queries:
--   query1:
--     interval: 5
--     databases: [db1]
--     metrics: [metric1]
--     sql: SELECT random() / 1000000000000000 AS metric1
--   query2:
--     interval: 20
--     timeout: 0.5
--     databases: [db1, db2]
--     metrics: [metric2, metric3]
--     sql: |
--       SELECT abs(random() / 1000000000000000) AS metric2,
--              abs(random() / 10000000000000000) AS metric3,
--              "value1" AS l1,
--              "value2" AS l2
--   query3:
--     schedule: "*/5 * * * *"
--     databases: [db2]
--     metrics: [metric4]
--     sql: |
--       SELECT value FROM (
--         SELECT "foo" AS metric4 UNION
--         SELECT "bar" AS metric3 UNION
--         SELECT "baz" AS metric4
--       )
--       ORDER BY random()
--       LIMIT 1


CREATE OR REPLACE FUNCTION graphql_query_result(base_url text, auth_token text, query text) returns JSON AS $$
import urllib.request, json
req = urllib.request.Request('{}/projects/{}/repository/files/{}/raw?ref=master'.format(base_url, project_id, asset_file_name))
--req.add_header('PRIVATE-TOKEN', auth_token)
resp = requests.post(url, json={'query': query})
--resp = urllib.request.urlopen(req)
return json.dumps(json.loads(resp.read().decode("utf-8")))
$$ LANGUAGE plpython3u;
comment on function graphql_query_result(text, text, text) is 'Retrieve a GitLab Project repo file as JSON';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_git_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    RETURN NEXT has_function('graphql'); 
END;
$$;
