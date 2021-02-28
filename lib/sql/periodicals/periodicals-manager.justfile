interpolateShebangContent := "../../interpolate-shebang-content.pl"
supplyRecipeJustFile := "../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippets to create common periodicals functions
psql-construct-periodicals:
    @cat periodicals-manager.sql

# Load periodical natures domain values
# populate-periodical-natures psqlCmd:
#     #!/usr/bin/env bash
#     CSVFILE="{{justfile_directory()}}/periodical-natures.content.csv"
#     SCRIPT=`just -f {{supplyRecipeJustFile}} sh-idempotent-import-csv-from-STDIN $CSVFILE {{tableName}} "{{psqlCmd}}"`
#     # TODO: need to make sure generated $SCRIPT does not have double-quotes inside?
#     eval "$SCRIPT"

# Generate psql SQL snippets to drop auth functions
psql-destroy-periodicals:
    #!/usr/bin/env {{interpolateShebangContent}}
    DROP FUNCTION IF EXISTS :dcp_schema_assurance.test_periodicals_manager();

# Generate the SQL snippets from child recipes
psql-construct: psql-construct-periodicals
  
# Generate the SQL snippets from child recipes
psql-destroy: psql-destroy-periodicals
