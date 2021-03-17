import * as mod from "../mod.ts";

export function SQL(
  ctx: mod.InterpolationContext,
): mod.InterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    { schema: ctx.sql.schemaName.typical("periodical") },
  );
  const unitTestFn = `test_${state.schema}`;
  const { schemaName: schema, functionName: fn } = ctx.sql;
  return mod.SQL(ctx.engine, state, {
    // if this template is embedded in another, leave indentation
    unindent: !mod.isEmbeddedInterpolationContext(ctx),
  })`
    -- TODO: CREATE DOMAIN provenance, URLs, etc.
    -- TODO: CREATE TYPE for type safety

    CREATE OR REPLACE PROCEDURE ${fn.lifecycle.construct(state.schema)}() AS $$
    BEGIN
        CREATE DOMAIN periodical_nature_id as INTEGER;
        CREATE DOMAIN periodical_id as BIGINT;

        CREATE TABLE IF NOT EXISTS periodical_nature(
            periodical_nature_id INTEGER primary key generated always as identity,
            periodical_nature TEXT NOT NULL,
            provenance TEXT NOT NULL,
            CONSTRAINT periodical_nature_unq_row UNIQUE(periodical_nature, provenance)
        );
        comment on table periodical_nature IS 'The kind of periodicals that can be managed';
        comment on table periodical_nature is E'@name periodical_nature\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

        CREATE OR REPLACE FUNCTION register_periodical_nature(nature TEXT, provenance TEXT) RETURNS INTEGER AS $innerFn$ 
        DECLARE
            pnId integer;
        BEGIN
            insert into periodical_nature (periodical_nature, provenance) values(nature, provenance) returning periodical_nature_id into pnId;
            return pnId;
        EXCEPTION
            when unique_violation then
                select periodical_nature_id into pnId from periodical_nature where periodical_nature = nature and provenance = provenance;
                return pnId;
        END;
        $innerFn$ LANGUAGE plpgsql;
        comment on function register_periodical_nature(nature TEXT, provenance TEXT) IS 'Register a new periodical type (ignore if it already exists)';
        comment on function register_periodical_nature(nature TEXT, provenance TEXT) is E'@name register_periodical_nature\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

        CREATE TABLE periodical(
            periodical_id BIGINT primary key generated always as identity,
            periodical_nature_id periodical_nature_id NOT NULL,
            constraint periodical_nature_fk foreign key (periodical_nature_id) REFERENCES periodical_nature(periodical_nature_id)
        );
        comment on table periodical IS 'An RSS/ATOM feed, e-mail newsletter, website, or other content source that changes periodically';
        comment on table periodical is E'@name periodical\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

        CREATE TABLE periodical_edition(
            periodical_edition_id bigint primary key generated always as identity,
            periodical_id periodical_id NOT NULL,
            constraint periodical_fk foreign key (periodical_id) REFERENCES periodical(periodical_id)
        );
        comment on table periodical IS 'A specific edition or instance of an RSS/Atom feed, e-mail newsletter, website, or other periodical';
        comment on table periodical is E'@name periodical\\n@omit update,delete\\nThis is to avoid mutations through Postgraphile.';

        CREATE OR REPLACE PROCEDURE ${
    fn.lifecycle.destroy(state.schema)
  }() AS $innerFn$
        BEGIN
            DROP FUNCTION IF EXISTS ${schema.assurance}.${unitTestFn}();
            DROP FUNCTION IF register_periodical_nature;
            DROP TABLE IF EXISTS periodical_edition CASCADE;
            DROP TABLE IF EXISTS periodical CASCADE;
            DROP TABLE IF EXISTS periodical_nature CASCADE;
            DROP DOMAIN periodical_nature_id;
            DROP DOMAIN periodical_id;
        END;
        $innerFn$ LANGUAGE PLPGSQL;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${schema.assurance}.${unitTestFn}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_table('periodical_nature');
        RETURN NEXT has_table('periodical');    
        RETURN NEXT has_table('periodical_edition');    
        RETURN NEXT has_function('register_periodical_nature');
    END;
    $$;`;
}
