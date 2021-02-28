-- PostgreSQL treats users and roles as synonyms. We treat roles as permissions
-- policies and users as authenticatable entities. It's just nomenclature but
-- important for consistency.
--
-- Variables expected:
-- * dcp_schema_auth_manager (e.g. "auth_manager")
--

CREATE OR REPLACE PROCEDURE create_role_if_not_exists(role_name text) AS $$ 
BEGIN
    EXECUTE FORMAT('CREATE ROLE %I WITH NOLOGIN', role_name);
EXCEPTION 
    WHEN DUPLICATE_OBJECT THEN
        RAISE NOTICE 'role "%" already exists, skipping', role_name;
END;
$$ LANGUAGE plpgsql;
comment on procedure create_role_if_not_exists(role_name TEXT) IS 'Create the role_name (without login privileges) if it does not already exist';

call create_role_if_not_exists('no_access_role');

CREATE OR REPLACE PROCEDURE create_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name text) AS $$ 
BEGIN
    call create_role_if_not_exists(role_name);
    EXECUTE FORMAT('GRANT USAGE ON SCHEMA %I TO %I', dcp_schema_name, role_name);
    EXECUTE FORMAT('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
    EXECUTE FORMAT('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
END;
$$ LANGUAGE plpgsql;
comment on procedure create_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name TEXT) IS 'Create the role_name and grant all privileges to it in dcp_schema_name';


CREATE OR REPLACE PROCEDURE create_all_privileges_views_role(view_name TEXT, role_name TEXT) AS $$ 
BEGIN
    call create_role_if_not_exists(role_name);
    EXECUTE FORMAT('GRANT ALL ON TABLE %I TO %I', view_name, role_name);
END;
$$ LANGUAGE plpgsql;
comment on procedure create_all_privileges_views_role(view_name TEXT, role_name TEXT) IS 'Grant all privileges to the given view for a given role';

-- TODO:
-- CREATE OR REPLACE PROCEDURE create_read_only_privileges_dcp_schema_role(dcp_schema_name TEXT, role_name TEXT) AS $$ 
-- BEGIN
--     GRANT USAGE ON SCHEMA dcp_schema_name TO role_name;
--     GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA dcp_schema_name TO role_name;
--     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA dcp_schema_name TO role_name;
-- END;
-- $$ LANGUAGE plpgsql;
-- comment on function create_read_only_privileges_dcp_schema_role(dcp_schema_name TEXT, role_name TEXT) IS 'Create the role_name and grant all privileges to it in dcp_schema_name';


CREATE OR REPLACE FUNCTION create_database_user_with_role(user_name NAME, user_passwd TEXT, role_name text) RETURNS smallint AS $BODY$
BEGIN
    -- escape properly to prevent SQL injection
    EXECUTE FORMAT('CREATE USER %I LOGIN PASSWORD ''%I''', user_name, user_passwd);
    EXECUTE FORMAT('GRANT %I TO %I', role_name, user_name);
    RETURN 1;
END;
$BODY$ LANGUAGE plpgsql STRICT VOLATILE SECURITY DEFINER COST 100;
comment on function create_database_user_with_role(user_name NAME, user_password text, user_role text) IS 'Create a user with user_name and password and assign it to the given role';
comment on function create_database_user_with_role(user_name NAME, user_password text, user_role text) is E'@omit execute';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_auth_manager() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_function('create_role_if_not_exists');
    RETURN NEXT has_function('create_all_privileges_dcp_schema_role');
    RETURN NEXT has_function('create_database_user_with_role');
    RETURN NEXT has_function('create_all_privileges_views_role');
    -- call twice without errors
    create schema assuranceTmp1;
    CALL create_role_if_not_exists('assurance_role1');
    CALL create_role_if_not_exists('assurance_role1');
    RETURN NEXT has_role('assurance_role1');
    RETURN NEXT ok((create_database_user_with_role('assurance_user1', 'password', 'assurance_role1') = 1),
                    'user assurance_user1 should be created with role assurance_role1');
    RETURN NEXT has_user('assurance_user1');
    DROP SCHEMA assuranceTmp1 cascade;
END;
$$;
