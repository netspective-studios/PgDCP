

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP ROLE IF EXISTS no_access_role;
CREATE ROLE no_access_role;

CREATE OR REPLACE FUNCTION grant_all_privileges_schema_role(schema_name TEXT,role_name TEXT ) RETURNS void
    LANGUAGE plpgsql
    AS $$ 
 BEGIN 
    
    GRANT USAGE ON SCHEMA schema_name TO role_name;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA schema_name TO role_name;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA schema_name TO role_name;
END;
$$;

-- CREATE OR REPLACE FUNCTION grant_read_only_privileges_schema_role(schema_name text,role_name text ) RETURNS void
--     LANGUAGE plpgsql
--     AS $$ 
--  BEGIN 
--     CREATE ROLE IF NOT EXISTS $2;
--     GRANT USAGE ON SCHEMA $1 TO $2;
--     GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA $1 TO $2;
--     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA $1 TO $2;
-- END;
-- $$;



-- Create a new user & role. User and role are the same in Postgres --
CREATE OR REPLACE FUNCTION create_user_with_role(user_name TEXT ,user_password TEXT) RETURNS void
    LANGUAGE plpgsql
    AS $$ 
 BEGIN 
--create user with password and assign the role. Role and user are the same in Postgres
DROP ROLE IF EXISTS user_name;
CREATE ROLE user_name WITH PASSWORD user_password;
END;
$$;

---create a type for JWT Token--
DROP TYPE IF EXISTS jwt_token_postgraphile CASCADE;
CREATE TYPE jwt_token_postgraphile AS (
role TEXT, --db role of the user
exp INTEGER, --expiry date as the unix epoch
user_id INTEGER, --db identifier of the user,
username TEXT --username used to sign in, user's email in our case
);

--Create a function to generate a JWT Token for the given username/password--


CREATE OR REPLACE FUNCTION authenticate_postgraphile(
username TEXT,
password TEXT
) RETURNS jwt_token_postgraphile AS $$
DECLARE
account users;
BEGIN
SELECT a.* INTO ACCOUNT
FROM pg_catalog.pg_user AS a 
WHERE a.username = authenticate_postgraphile.username;

IF account.password = crypt(password, account.password) THEN
RETURN (
account.username,
extract(epoch FROM now() + interval '7 days'),
account.id,
account.username
)::public.jwt_token_postgraphile;
ELSE
RETURN NULL;
END IF;
END;
$$ LANGUAGE plpgsql STRICT SECURITY DEFINER;




CREATE OR REPLACE FUNCTION :schema_assurance.test_auth_manager() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('grant_all_privileges_schema_role');
    RETURN NEXT has_function('create_user_with_role');
    RETURN NEXT has_function('authenticate_postgraphile');
    RETURN NEXT has_type('jwt_token_postgraphile');
END;
$$;
