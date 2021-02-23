contentCsvFileName := "IETF-RFC6838-media-types.content.csv"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"
emitRecipeCmd := "../../emit-recipe-content.pl"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippet to create the media type table
psql-construct-media-types tableName: (_pg-dcp-recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{emitRecipeCmd}}
    -- compute derived objects based on table name (\gset will capture output and assign to variable)
    select format('%s_unq_row', :'media_type_table_name') as media_type_table_unq_row_constraint_name \gset
    select format('test_%s', :'media_type_table_name') as test_media_types_fn_name \gset

    CREATE TABLE :media_type_table_name (
        mime_type TEXT,
        file_extn TEXT,
        label TEXT,
        CONSTRAINT :media_type_table_unq_row_constraint_name UNIQUE(mime_type, file_extn, label)
    );

    CREATE OR REPLACE FUNCTION :schema_assurance.:test_media_types_fn_name() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_table(:'media_type_table_name');
        RETURN NEXT ok(((select count(*) from :media_type_table_name) > 0),
                    format('Should have content in %s', :'media_type_table_name'));
    END;
    $$;

# Generate psql SQL snippet to drop the media type table if it exists
psql-destroy-media-types tableName: (_pg-dcp-recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{emitRecipeCmd}}
    select format('test_%s', :'media_type_table_name') as test_media_types_fn_name \gset
    DROP FUNCTION IF EXISTS :schema_assurance.:test_media_types_fn_name();
    DROP TABLE IF NOT EXISTS :media_type_table_name;

# Execute psql to load MIME type and file extensions mapping content into media type table
populate-media-types tableName psqlCmd:
    #!/usr/bin/env bash
    CSVFILE="{{justfile_directory()}}/{{contentCsvFileName}}"
    SCRIPT=`just -f {{supplyRecipeJustFile}} sh-idempotent-import-csv-from-STDIN $CSVFILE {{tableName}} "{{psqlCmd}}"`
    # TODO: need to make sure generated $SCRIPT does not have double-quotes inside?
    eval "$SCRIPT"

# Generate psql SQL snippets to create common content manipulation functions
psql-construct-immutable-functions:
    @cat content-assembler-routines.sql

# Generate psql SQL snippets to drop common content manipulation functions
psql-destroy-immutable-functions:
    #!/usr/bin/env {{emitRecipeCmd}}
    DROP FUNCTION IF EXISTS :schema_assurance.test_content_assembler_text_manipulation();
    DROP FUNCTION IF EXISTS slugify(text);
    DROP FUNCTION IF EXISTS prepare_file_name(text, text);
    DROP FUNCTION IF EXISTS url_brand(text);

# Generate complete psql SQL to create all content assembler library of objects
psql-construct mediaTypeTableName: (psql-construct-media-types mediaTypeTableName) (psql-construct-immutable-functions)

# Generate complete psql SQL to drop all content assembler library of objects
psql-destroy mediaTypeTableName: (psql-destroy-media-types mediaTypeTableName) (psql-destroy-immutable-functions)

