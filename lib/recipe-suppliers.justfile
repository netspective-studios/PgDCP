interpolateShebangContent := "./interpolate-shebang-content.pl"

# Generate psql SQL snippet that can create a variable assignment with default value
psql-set-var-with-default varName varDefault:
    #!/usr/bin/env {{interpolateShebangContent}}
    -- default {{varName}} if not passed in (\gset will capture output and assign to variable)
    \set {{varName}} :{{varName}}
    SELECT CASE 
        WHEN :'{{varName}}' = ':{{varName}}'
        THEN '{{varDefault}}' -- the default value, since :{{varName}} was not supplied
        ELSE :'{{varName}}'  -- the value that was passed in via psql
    END AS {{varName}} \gset

# Generate psql SQL snippet to load CSV into a destination table
sql-import-csv-from-STDIN destTableName:
    #!/usr/bin/env {{interpolateShebangContent}}
    COPY {{destTableName}} FROM STDIN (format csv, delimiter ',', header true);

# Generate a snippet of SQL that can be passed into psql to read CSV stream via 
# STDIN into an interim table (whose structure is copied from a destination table) 
# and insert from interim into the destination. We do this because the COPY FROM 
# command does not have the capability to define what to do on conflicts and we 
# want the CSV loading to be idemponent.
# Generate psql snippet to load CSV idemponently into a destination table
sql-idempotent-import-csv-from-STDIN destTableName:
    #!/usr/bin/env {{interpolateShebangContent}}
    CREATE TEMP TABLE temp_{{destTableName}} AS SELECT * FROM {{destTableName}} LIMIT 0;
    COPY temp_{{destTableName}} FROM STDIN (format csv, delimiter ',', header true);
    INSERT INTO {{destTableName}} SELECT * FROM temp_{{destTableName}} ON CONFLICT DO NOTHING;
    DROP TABLE temp_{{destTableName}};

# Generate bash script which can be eval'd to load CSV idemponently into a destination table
sh-idempotent-import-csv-from-STDIN srcCsvFileName destTableName psqlCmd="psql -q":
    #!/usr/bin/env bash
    # TODO: make sure commands have their double-quotes escaped
    PSQL_CMDS=`just -f {{justfile()}} sql-idempotent-import-csv-from-STDIN {{destTableName}} | awk '{printf "-c \"%s\" ",$0} END {print ""}'`
    echo "cat {{srcCsvFileName}} | {{psqlCmd}} $PSQL_CMDS"

# Generate psql SQL script which inserts CSV idemponently into a destination table
psql-idempotent-import-csv-from-embedded srcCsvFileName destTableName:
    #!/usr/bin/env bash
    echo "CREATE TEMP TABLE temp_{{destTableName}} AS SELECT * FROM {{destTableName}} LIMIT 0;"
    echo "COPY temp_{{destTableName}} FROM STDIN (format csv, delimiter ',', header true);"
    cat {{srcCsvFileName}}
    echo "\."
    echo "INSERT INTO {{destTableName}} SELECT * FROM temp_{{destTableName}} ON CONFLICT DO NOTHING;"
    echo "DROP TABLE temp_{{destTableName}};"
