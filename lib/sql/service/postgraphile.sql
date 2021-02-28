CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- We want all our object creations to be idempotent whenever possible
DO $$
BEGIN
    CREATE TYPE jwt_token_postgraphile AS (
        role TEXT, --db role of the user
        exp INTEGER, --expiry date as the unix epoch
        user_id INTEGER, --db identifier of the user,
        username TEXT --username used to sign in, user's email in our case
    );
    comment on type jwt_token_postgraphile IS 'User credentials Postgraphile will use to create JWT for API authentication';
EXCEPTION
    WHEN DUPLICATE_OBJECT THEN
        RAISE NOTICE 'type "jwt_token_postgraphile" already exists, skipping';
END
$$;

CREATE OR REPLACE FUNCTION authenticate_postgraphile_pg_native(username TEXT, password TEXT) RETURNS jwt_token_postgraphile AS $$
DECLARE
    found_user_name text := NULL;
    found_user_passwd text := NULL;
    id text :=NULL;
BEGIN
    SELECT rolname, rolpassword 
    INTO found_user_name, found_user_passwd,id
    FROM pg_catalog.pg_roles
    WHERE rolname = username;

    IF found_user_passwd = md5(password) THEN
    RETURN (
        found_user_name,
        extract(epoch FROM now() + interval '7 days'),
        id,
        found_user_name);
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;
comment on function authenticate_postgraphile_pg_native(dcp_schema_name TEXT, role_name TEXT) IS 'Create a user with user_name and password and assign it to the given role';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_auth_postgraphile() RETURNS SETOF TEXT AS $$
BEGIN 
    RETURN NEXT has_extension('pgcrypto');
    RETURN NEXT has_type('jwt_token_postgraphile');
    RETURN NEXT has_function('authenticate_postgraphile_pg_native');
END;
$$ LANGUAGE plpgsql;
