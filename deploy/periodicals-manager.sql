-- TODO: CREATE DOMAIN provenance, URLs, etc.
-- TODO: CREATE TYPE for type safety
${define({
    package: 'periodicals_manager', 
    unitTestFn: 'test_periodicals_manager'
  })}

CREATE OR REPLACE PROCEDURE ${ctx.fn.deploy.construct(local.package)}() AS $$
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
    comment on table periodical_nature is E'@name periodical_nature\n@omit update,delete\nThis is to avoid mutations through Postgraphile.';

    CREATE OR REPLACE FUNCTION register_periodical_nature(nature TEXT, provenance TEXT) RETURNS INTEGER AS $$ 
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
    $$ LANGUAGE plpgsql;
    comment on function register_periodical_nature(nature TEXT, provenance TEXT) IS 'Register a new periodical type (ignore if it already exists)';
    comment on function register_periodical_nature(nature TEXT, provenance TEXT) is E'@name register_periodical_nature\n@omit update,delete\nThis is to avoid mutations through Postgraphile.';

    CREATE TABLE periodical(
        periodical_id BIGINT primary key generated always as identity,
        periodical_nature_id periodical_nature_id NOT NULL,
        constraint periodical_nature_fk foreign key (periodical_nature_id) REFERENCES periodical_nature(periodical_nature_id)
    );
    comment on table periodical IS 'An RSS/ATOM feed, e-mail newsletter, website, or other content source that changes periodically';
    comment on table periodical is E'@name periodical\n@omit update,delete\nThis is to avoid mutations through Postgraphile.';

    CREATE TABLE periodical_edition(
        periodical_edition_id bigint primary key generated always as identity,
        periodical_id periodical_id NOT NULL,
        constraint periodical_fk foreign key (periodical_id) REFERENCES periodical(periodical_id)
    );
    comment on table periodical IS 'A specific edition or instance of an RSS/Atom feed, e-mail newsletter, website, or other periodical';
    comment on table periodical is E'@name periodical\n@omit update,delete\nThis is to avoid mutations through Postgraphile.';
END;
$$ LANGUAGE PLPGSQL;

CREATE OR REPLACE PROCEDURE ${ctx.fn.deploy.destroy(local.package)}() AS $$
BEGIN
    DROP FUNCTION IF EXISTS ${ctx.schema.assurance}.${local.unitTestFn}();
    DROP FUNCTION IF register_periodical_nature;
    DROP TABLE IF EXISTS periodical_edition CASCADE;
    DROP TABLE IF EXISTS periodical CASCADE;
    DROP TABLE IF EXISTS periodical_nature CASCADE;
    DROP DOMAIN periodical_nature_id;
    DROP DOMAIN periodical_id;
END;
$$ LANGUAGE PLPGSQL;

CREATE OR REPLACE FUNCTION ${ctx.schema.assurance}.${local.unitTestFn}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_table('periodical_nature');
    RETURN NEXT has_table('periodical');    
    RETURN NEXT has_table('periodical_edition');    
    RETURN NEXT has_function('register_periodical_nature');
END;
$$;
