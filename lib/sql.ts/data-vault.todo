interpolateShebangContent := "../../interpolate-shebang-content.pl"
supplyRecipeJustFile := "../../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippet to create the Data Vault Hub objects
psql-construct-hub hub businessKey businessKeyType:
    #!/usr/bin/env {{interpolateShebangContent}}
    CREATE TABLE {{hub}}(
        {{hub}}_id uuid AS IDENTITY default gen_random_uuid(),
        {{businessKey}} {{businessKeyType}} NOT NULL,
        provenance text NOT NULL,
        loaded_at timestamp with time zone NOT NULL default current_date(),
        CONSTRAINT {{hub}}_pk UNIQUE({{hub}}_id)
    );

# Generate psql SQL snippet to drop the Data Vault Hub objects
psql-destroy-hub hub:
    #!/usr/bin/env {{interpolateShebangContent}}
    drop table if exists {{hub}};
