interpolateShebangContent := "../interpolate-shebang-content.pl"
supplyRecipeJustFile := "../recipe-suppliers.justfile"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippet to create a named documents's objects
psql-construct tableName:
    #!/usr/bin/env {{interpolateShebangContent}}
    CREATE EXTENSION if not exists ltree;

    CREATE TABLE {{tableName}}(
        id integer GENERATED BY DEFAULT AS IDENTITY,
        path ltree NOT NULL,
        name ltree NOT NULL,
        content JSONB not null,
        description text,
        active boolean NOT NULL DEFAULT TRUE,
        created_at timestamp with time zone NOT NULL default current_date,
        updated_at timestamp with time zone,
        deleted_at timestamp with time zone,
        CONSTRAINT {{tableName}}_pk UNIQUE(id),
        CONSTRAINT {{tableName}}_unq_row UNIQUE(path, name)
    );
    CREATE INDEX {{tableName}}_path_idx ON {{tableName}} USING gist (path);
    CREATE INDEX {{tableName}}_name_idx ON {{tableName}} USING gist (name);

# Generate psql SQL snippet to drop all named tableName objects
psql-destroy tableName:
    #!/usr/bin/env {{interpolateShebangContent}}
    drop table if exists {{tableName}};
