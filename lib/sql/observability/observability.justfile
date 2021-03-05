interpolateShebangContent := "../../interpolate-shebang-content.pl"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippets to create common Git management functions
psql-construct-immutable-functions:
    @cat open-metrics.sql

# Generate psql SQL snippets to drop common Git management functions
psql-destroy-immutable-functions:
    #!/usr/bin/env {{interpolateShebangContent}}
    DROP FUNCTION IF EXISTS :dcp_schema_assurance.test_git_management();
    DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_TEXT(TEXT, TEXT, INTEGER, TEXT);
    DROP FUNCTION GITLAB_PROJECT_ASSET_CONTENT_JSON(TEXT, TEXT, INTEGER, TEXT);

# Generate complete psql SQL to create all Git management library of objects
psql-construct: psql-construct-immutable-functions

# Generate complete psql SQL to drop  all Git management library of objects
psql-destroy: psql-destroy-immutable-functions
