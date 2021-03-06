import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.lifecycle,
      searchPath: [
        schemas.lifecycle,
        schemas.lib,
      ],
      extensions: [
        schemas.extensions.ltreeExtn,
        schemas.extensions.semverExtn,
      ],
    },
  );
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE FUNCTION version_sql(schemaName text, versionTableName text, versionedItemColName text, defaultCtx text, initVersion semver) RETURNS text AS $$
    BEGIN
        return format($execBody$
            ${state.setSearchPathSql("%1$s")};

            CREATE TABLE IF NOT EXISTS %1$s.%2$s_store(
                id integer GENERATED BY DEFAULT AS IDENTITY,
                nature ltree NOT NULL,
                context ltree,
                %3$s_path ltree NOT NULL,
                %3$s text NOT NULL,
                version semver NOT NULL,
                description text,
                labels text[],
                %3$s_elaboration jsonb,
                meta_data jsonb,
                created_at timestamp with time zone NOT NULL default current_date,
                created_by name NOT NULL default current_user,
                CONSTRAINT %2$s_identity UNIQUE(id),
                CONSTRAINT %2$s_unq_row UNIQUE(nature, context, %3$s_path, %3$s, version)
            );
            CREATE INDEX IF NOT EXISTS %2$s_store_nature_idx ON %1$s.%2$s_store USING gist (nature);
            CREATE INDEX IF NOT EXISTS %2$s_store_context_idx ON %1$s.%2$s_store USING gist (context);
            CREATE INDEX IF NOT EXISTS %2$s_store_%3$s_path_idx ON %1$s.%2$s_store USING gist (%3$s_path);
            CREATE INDEX IF NOT EXISTS %2$s_store_%3$s_idx ON %1$s.%2$s_store (%3$s);
            CREATE INDEX IF NOT EXISTS %2$s_store_version_idx ON %1$s.%2$s_store (version);
            CREATE INDEX IF NOT EXISTS %2$s_store_version_hash_idx ON %1$s.%2$s_store USING hash (version);
            CREATE INDEX IF NOT EXISTS %2$s_store_labels_idx ON %1$s.%2$s_store USING gin (labels);

            -- TODO: add, optionally, %1$s.%2$s_pg_relationship table to connect %1$s.%2$s_store record
            --       to PostgreSQL object catalogs; that way, we can tie the official catalog to specific
            --       versions as well
            -- TODO: add, optionally, %1$s.%2$s_event_relationship table to connect %1$s.%2$s_store record
            --       to an existing event manager row; that way, we can tie an event to a version of something

            CREATE OR REPLACE FUNCTION %1$s.%2$s_initial_revision() RETURNS semver LANGUAGE sql IMMUTABLE PARALLEL SAFE AS 'SELECT ''%5$s''::semver';

            -- TODO: add %1$s.%2$s_next_major, %1$s.%2$s_next_minor, and %1$s.%2$s_next_patch
            -- CREATE FUNCTION %1$s.%2$s_next_major(version semver) RETURNS semver LANGUAGE sql IMMUTABLE PARALLEL SAFE AS '(get_semver_major($1))';

            CREATE OR REPLACE VIEW %1$s.%2$s AS
                select *
                  from %1$s.%2$s_store
                order by version, created_at desc;

            CREATE OR REPLACE VIEW %1$s.%2$s_latest AS
                select distinct on (nature, context, %3$s_path, %3$s, max(version)) version, created_at, nature, context, %3$s_path, %3$s
                from %1$s.%2$s_store
                group by version, created_at, nature, context, %3$s_path, %3$s 
                order by nature, context, %3$s_path, %3$s, max(version), created_at desc;

            create or replace function %1$s.version_upsert_%2$s() returns trigger as $genBody$
            declare
                %2$sId integer;
            begin
                -- TODO: if nature, context, %3$s already exists in the table, get the most recent record
                -- and increment it
                insert into %1$s.%2$s_store (nature, context, %3$s_path, %3$s, version, description, labels, %3$s_elaboration, meta_data) select 
                    NEW.nature,
                    (CASE WHEN (NEW.context IS NULL) THEN '%4$s' ELSE NEW.context END),
                    (CASE WHEN (NEW.%3$s_path IS NULL) THEN NEW.%3$s::ltree ELSE NEW.%3$s_path END),
                    (CASE WHEN (NEW.%3$s IS NULL) THEN NEW.%3$s_path::text ELSE NEW.%3$s END),
                    NEW.version,
                    NEW.description,
                    NEW.labels,
                    NEW.%3$s_elaboration,
                    NEW.meta_data
                    on conflict on constraint asset_version_unq_row do nothing
                  returning id into %2$sId ;
                return NEW;
            end;
            $genBody$ language plpgsql;
            
            DO $versionUpsertBody$
            BEGIN
              create trigger version_upsert_%2$s_trigger
              instead of insert on %1$s.%2$s
              for each row execute function %1$s.version_upsert_%2$s();
            EXCEPTION
                WHEN duplicate_object THEN
                    RAISE NOTICE 'Trigger already exists. Ignoring...';
            END
            $versionUpsertBody$;

            CREATE OR REPLACE PROCEDURE ${
    schemas.lifecycle.qualifiedReference(
      "version_%1$s_%2$s_destroy_all_objects",
    )
  }() AS $genBody$
            BEGIN
                EXECUTE('drop table if exists %1$s.%2$s cascade');
            END;
            $genBody$ LANGUAGE PLPGSQL;
        $execBody$, schemaName, versionTableName, versionedItemColName, defaultCtx, initVersion);
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE PROCEDURE version_construct(schemaName text, versionTableName text, versionedItemColName text, defaultCtx text, initVersion semver) AS $$
    BEGIN
        -- TODO: register execution in DCP Lifecyle event table
        EXECUTE(version_sql(schemaName, versionTableName, versionedItemColName, defaultCtx, initVersion));
    END;
    $$ LANGUAGE PLPGSQL;`;
}
