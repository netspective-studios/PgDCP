interpolateShebangContent := "../../interpolate-shebang-content.pl"
contentCsvFileName := "IETF-RFC6838-media-types.content.csv"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippets to create common image management functions
psql-construct-immutable-functions:
    @cat image-manager.sql

# Generate psql SQL snippets to drop common image management functions
psql-destroy-immutable-functions:
    #!/usr/bin/env {{interpolateShebangContent}}
    DROP FUNCTION IF EXISTS :dcp_schema_assurance.test_image_management();
    DROP FUNCTION IF EXISTS image_format_size(bytea);
    DROP TYPE IF EXISTS image_format_size_type;

# Generate complete psql SQL to create all image management library of objects
psql-construct: psql-construct-immutable-functions

# Generate complete psql SQL to drop  all image management library of objects
psql-destroy mediaTypeTableName: psql-destroy-immutable-functions
