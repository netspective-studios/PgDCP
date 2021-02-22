contentCsvFileName := "IETF-RFC6838-media-types.content.csv"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"
emitRecipeCmd := "../../emit-recipe-content.pl"

recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

psql-construct-media-types tableName: (recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{emitRecipeCmd}}
    -- compute constraint name based on table name (\gset will capture output and assign to variable)
    select format('%s_unq_row', :'media_type_table_name') as media_type_table_unq_row_constraint_name \gset

    CREATE TABLE :media_type_table_name (
        mime_type TEXT,
        file_extn TEXT,
        label TEXT,
        CONSTRAINT :media_type_table_unq_row_constraint_name UNIQUE(mime_type, file_extn, label)
    );

psql-destroy-media-types tableName: (recipe "psql-set-var-with-default" "media_type_table_name" tableName)
    #!/usr/bin/env {{emitRecipeCmd}}
    DROP TABLE IF NOT EXISTS :media_type_table_name;

populate-media-types tableName psqlCmd:
    #!/usr/bin/env bash
    CSVFILE="{{justfile_directory()}}/{{contentCsvFileName}}"
    SCRIPT=`just -f {{supplyRecipeJustFile}} sh-idempotent-import-csv-from-STDIN $CSVFILE {{tableName}} "{{psqlCmd}}"`
    # TODO: need to make sure generated $SCRIPT does not have double-quotes inside?
    eval "$SCRIPT"

psql-construct-immutable-functions:
    @cat content-assembler-routines.sql

psql-construct mediaTypeTableName: (psql-construct-media-types mediaTypeTableName) psql-construct-immutable-functions
