create extension if not exists unaccent;

CREATE OR REPLACE FUNCTION slugify("value" TEXT) RETURNS TEXT AS $$ 
    -- removes accents (diacritic signs) from a given string --
    WITH "unaccented" AS (
        SELECT unaccent("value") AS "value"
    ),
    -- lowercases the string
    "lowercase" AS (
        SELECT lower("value") AS "value"
        FROM "unaccented"
    ),
    -- remove single and double quotes
    "removed_quotes" AS (
        SELECT regexp_replace("value", '[''"]+', '', 'gi') AS "value"
        FROM "lowercase"
    ),
    -- replaces anything that's not a letter, number, hyphen('-'), or underscore('_') with a hyphen('-')
    "hyphenated" AS (
        SELECT regexp_replace("value", '[^a-z0-9\\-_]+', '-', 'gi') AS "value"
        FROM "removed_quotes"
    ),
    -- trims hyphens('-') if they exist on the head or tail of the string
    "trimmed" AS (
        SELECT regexp_replace(regexp_replace("value", '\-+$', ''), '^\-', '') AS "value"
        FROM "hyphenated"
    )
    SELECT "value"
    FROM "trimmed";
$$ LANGUAGE SQL STRICT IMMUTABLE SET SEARCH_PATH TO :dcp_schema_content_assembler, :dcp_schema_miniflux;
comment on function slugify("value" TEXT) is 'Given a string such as a URL, remove diacritic marks, lowercase the string, and return with hyphens between words';

create or replace function prepare_file_name(basis TEXT, extn TEXT, max_length smallint = 100) returns TEXT as $$
declare 
    file_name TEXT;
begin
    select concat(slugify(basis), extn) into file_name;
    return substring(
        file_name
        from 1 for max_length
    );
end;
$$ LANGUAGE plpgsql STRICT IMMUTABLE SET SEARCH_PATH TO :dcp_schema_content_assembler, :dcp_schema_miniflux;
comment on function prepare_file_name(basis TEXT, extn TEXT, max_length smallint) IS 'Given a title or other basis, create a good filename for storing content';

create or replace function url_brand(url TEXT) returns TEXT as $$
declare 
    host_name TEXT;
begin
    SELECT token
    FROM ts_debug(url)
    where alias = 'host' into host_name;
    return ltrim(host_name, 'www.');
end;
$$ LANGUAGE plpgsql STRICT IMMUTABLE SET SEARCH_PATH TO :dcp_schema_content_assembler, :dcp_schema_miniflux;
comment on function url_brand(url TEXT) IS 'Given a URL, return the hostname only without "www." prefix';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_content_assembler_text_manipulation() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('unaccent');
    RETURN NEXT has_function('slugify');
    RETURN NEXT has_function('prepare_file_name');
    RETURN NEXT has_function('url_brand');
END;
$$;
