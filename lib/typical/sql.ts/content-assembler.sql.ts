import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup(
  "text_manipulation",
);

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || {
      schema: schemas.lib,
      affinityGroup,
      searchPath: [schemas.lib],
      extensions: [schemas.extensions.unaccentExtn],
    },
  );
  const [exQR, lQR] = state.observableQR(schemas.extensions, schemas.lib);
  const { lcFunctions: fn } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`    
    CREATE OR REPLACE FUNCTION ${lQR("slugify")}("value" TEXT) RETURNS TEXT AS $$ 
        -- removes accents (diacritic signs) from a given string --
        WITH "unaccented" AS (
            SELECT ${exQR("unaccent")}("value") AS "value"
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
    $$ LANGUAGE SQL STRICT IMMUTABLE;
    comment on function slugify("value" TEXT) is 'Given a string such as a URL, remove diacritic marks, lowercase the string, and return with hyphens between words';
    
    create or replace function ${lQR("prepare_file_name")}(basis TEXT, extn TEXT, max_length smallint = 100) returns TEXT as $$
    declare 
      file_name TEXT;
    begin
      select concat(${lQR("slugify")}(basis), extn) into file_name;
      return substring(
        file_name
        from 1 for max_length
      );
    end;
    $$ LANGUAGE plpgsql STRICT IMMUTABLE SECURITY DEFINER;
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
    $$ LANGUAGE plpgsql STRICT IMMUTABLE ;
    comment on function url_brand(url TEXT) IS 'Given a URL, return the hostname only without "www." prefix';
    
    CREATE OR REPLACE FUNCTION csv_to_table(file_path text, table_name text = 'temp', schema_name text DEFAULT 'public'::text,delim text = ',', encoder text DEFAULT 'UTF8'::text,no_delim text = chr(127)) RETURNS text as $csvToTable$
    DECLARE
      row_ct int;
    BEGIN
      CREATE TEMP TABLE tmp(cols text) ON COMMIT DROP;
      EXECUTE format($$DROP table if exists %I.%I cascade;$$, schema_name,table_name);
      -- fetch 1st row
      EXECUTE format($$COPY tmp FROM PROGRAM 'head -n1 %I' WITH (DELIMITER %L,NULL '/N',ENCODING %L)$$, file_path, no_delim,encoder);
      -- create actual temp table with all columns text
      EXECUTE (SELECT format('CREATE TABLE %I.%I(', schema_name,table_name)
          || string_agg(lower(regexp_replace(TRIM(col), '[^a-zA-Z0-9_]+', '_','g')) || ' text', ',')
          || ')'
      FROM  (SELECT cols FROM tmp LIMIT 1) t, unnest(string_to_array(t.cols, delim)) col);
      -- Import data
      EXECUTE format($$COPY %I.%I FROM %L WITH (FORMAT csv, HEADER, NULL '/N', DELIMITER %L,ENCODING %L)$$, schema_name,table_name, file_path, delim,encoder);
      GET DIAGNOSTICS row_ct = ROW_COUNT;
      DROP TABLE tmp;
      RETURN format('Created table %I with %s rows.', table_name, row_ct);
      EXCEPTION WHEN OTHERS THEN
        RETURN format('Got exception: %I',SQLERRM);
    END $csvToTable$  LANGUAGE plpgsql;
    comment on function csv_to_table(file_path text, table_name text, schema_name text,delim text, encoder text, no_delim text) IS 'Given CSV file, return a table with contents and dynamic number of columns';

    CREATE OR REPLACE PROCEDURE ${lQR("set_curlopt_timeout")}() AS $$
    BEGIN
      Perform (SELECT ${exQR("http_set_curlopt")}('CURLOPT_TIMEOUT_MS', '60000'));
    END; $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS slugify(text);
        DROP FUNCTION IF EXISTS prepare_file_name(text, text);
        DROP FUNCTION IF EXISTS url_brand(text);
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE FUNCTION ${
    fn.unitTest(state).qName
  }() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
        RETURN NEXT has_extension('unaccent');
        RETURN NEXT has_function('slugify');
        RETURN NEXT has_function('prepare_file_name');
        RETURN NEXT has_function('url_brand');
    END;
    $$;`;
}
