interpolateShebangContent := "../../interpolate-shebang-content.pl"
contentCsvFileName := "IETF-RFC6838-media-types.content.csv"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippet to create the media type table
psql-construct-media-types tableName: (_pg-dcp-recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{interpolateShebangContent}}
    -- compute derived objects based on table name (\gset will capture output and assign to variable)
    select format('%s_unq_row', :'media_type_table_name') as media_type_table_unq_row_constraint_name \gset
    select format('test_%s', :'media_type_table_name') as test_media_types_fn_name \gset

    CREATE TABLE :media_type_table_name (
        mime_type TEXT,
        file_extn TEXT,
        label TEXT,
        CONSTRAINT :media_type_table_unq_row_constraint_name UNIQUE(mime_type, file_extn, label)
    );

    -- We want to use :'media_type_table_name' inside the function body but $$...$$ is already interpolated
    -- so we need to create a dynamic body first, assign it to a variable, then create the function from the 
    -- variable. 
    select format($$BEGIN
        RETURN NEXT has_table('%s');
        RETURN NEXT ok(((select count(*) from %I) > 0),
                      'Should have content in %s');
    END;$$, :'media_type_table_name', :'media_type_table_name', :'media_type_table_name') as interpolated_fn_body \gset
    CREATE OR REPLACE FUNCTION :dcp_schema_assurance.:test_media_types_fn_name() RETURNS SETOF TEXT AS
    :'interpolated_fn_body'
    LANGUAGE plpgsql;

# Generate psql SQL snippet to drop the media type table if it exists
psql-destroy-media-types tableName: (_pg-dcp-recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{interpolateShebangContent}}
    select format('test_%s', :'media_type_table_name') as test_media_types_fn_name \gset
    DROP FUNCTION IF EXISTS :dcp_schema_assurance.:test_media_types_fn_name();
    DROP TABLE IF NOT EXISTS :media_type_table_name;

# Generate psql SQL snippet to load MIME type and file extensions mapping content into media type table
psql-populate-media-types tableName:
    just -f {{supplyRecipeJustFile}} psql-idempotent-import-csv-from-embedded "{{justfile_directory()}}/{{contentCsvFileName}}" {{tableName}}

# Generate psql SQL snippets to create common content manipulation functions
psql-construct-immutable-functions:
    @cat content-assembler.sql

# Generate psql SQL snippets to drop common content manipulation functions
psql-destroy-immutable-functions:
    #!/usr/bin/env {{interpolateShebangContent}}
    DROP FUNCTION IF EXISTS :dcp_schema_assurance.test_content_assembler_text_manipulation();
    DROP FUNCTION IF EXISTS slugify(text);
    DROP FUNCTION IF EXISTS prepare_file_name(text, text);
    DROP FUNCTION IF EXISTS url_brand(text);

# Generate complete psql SQL to create all content assembler library of objects
psql-construct mediaTypeTableName: (psql-construct-media-types mediaTypeTableName) (psql-construct-immutable-functions) (psql-populate-media-types mediaTypeTableName)

# Generate complete psql SQL to drop all content assembler library of objects
psql-destroy mediaTypeTableName: (psql-destroy-media-types mediaTypeTableName) (psql-destroy-immutable-functions)

