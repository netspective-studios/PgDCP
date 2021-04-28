import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("shield");

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || { schema: schemas.lib, affinityGroup },
  );
  const { lcFunctions: fn } = state.affinityGroup;
  const [lQR] = state.observableQR(
    schemas.lib,
  );

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    -- PostgreSQL treats users and roles as synonyms. We treat roles as permissions
    -- policies and users as authenticatable entities. It's just nomenclature but
    -- important for consistency.

    -- TODO: prefix all procedure names with affinity group

    CREATE OR REPLACE PROCEDURE create_role_if_not_exists(role_name text) AS $$ 
    BEGIN
      EXECUTE FORMAT('CREATE ROLE %I WITH NOLOGIN', role_name);
    EXCEPTION 
      WHEN DUPLICATE_OBJECT THEN
          RAISE NOTICE 'role "%" already exists, skipping', role_name;
    END;
    $$ LANGUAGE plpgsql;
    comment on procedure create_role_if_not_exists(role_name TEXT) IS 'Create the role_name (without login privileges) if it does not already exist';

    call ${lQR("create_role_if_not_exists")}('no_access_role');

    CREATE OR REPLACE PROCEDURE create_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name text) AS $$ 
    BEGIN
      call ${lQR("create_role_if_not_exists")}(role_name);
      EXECUTE FORMAT('GRANT USAGE ON SCHEMA %I TO %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
      -- Grants the same privileges as exists in the current schema for all future table or views that are created after calling this function.
      EXECUTE FORMAT('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL PRIVILEGES ON TABLES TO %I', dcp_schema_name, role_name);
    END;
    $$ LANGUAGE plpgsql;
    comment on procedure create_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name TEXT) IS 'Create the role_name and grant all privileges to it in dcp_schema_name';

    CREATE OR REPLACE PROCEDURE create_read_only_privileges_dcp_schema_role(dcp_schema_name TEXT, role_name TEXT) AS $$ 
    BEGIN
      call ${lQR("create_role_if_not_exists")}(role_name);
      EXECUTE FORMAT('GRANT USAGE ON SCHEMA %I TO %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', dcp_schema_name, role_name);
      -- Grants the same privileges as exists in the current schema for all future table or views that are created after calling this function.
      EXECUTE FORMAT('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO %I', dcp_schema_name, role_name); 
    END;
    $$ LANGUAGE plpgsql;
    comment on procedure create_read_only_privileges_dcp_schema_role(dcp_schema_name TEXT, role_name TEXT) IS 'Create the role_name and grant read only privileges to it in dcp_schema_name';

    CREATE OR REPLACE FUNCTION create_database_user_with_role(user_name NAME, user_passwd TEXT, role_name text) RETURNS smallint AS $BODY$
    BEGIN
      -- escape properly to prevent SQL injection
      IF NOT EXISTS ( SELECT FROM pg_roles WHERE  rolname = user_name) THEN
        EXECUTE FORMAT('CREATE USER %I WITH LOGIN PASSWORD %L', user_name, user_passwd);
        EXECUTE FORMAT('GRANT %I TO %I', role_name, user_name);
      END IF;
      RETURN 1;
    END;
    $BODY$ LANGUAGE plpgsql STRICT VOLATILE SECURITY DEFINER COST 100;
    comment on function create_database_user_with_role(user_name NAME, user_password text, user_role text) IS 'Create a user with user_name and password and assign it to the given role';

    CREATE OR REPLACE PROCEDURE revoke_all_privileges_views_role(schema_name text,view_name TEXT, role_name TEXT) AS $$
    BEGIN
      EXECUTE FORMAT('REVOKE ALL ON %I.%I FROM %I',schema_name,view_name, role_name);
    END;
    $$ LANGUAGE plpgsql;
    comment on procedure revoke_all_privileges_views_role(schema_name TEXT,view_name TEXT, role_name TEXT) IS 'Revoke all privileges to the given view for a given role';

    CREATE OR REPLACE PROCEDURE revoke_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name text) AS $$
    BEGIN
      EXECUTE FORMAT('REVOKE ALL PRIVILEGES ON SCHEMA %I FROM %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA %I FROM %I', dcp_schema_name, role_name);
      EXECUTE FORMAT('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA %I FROM %I', dcp_schema_name, role_name);
    END;$$ LANGUAGE plpgsql;
    comment on procedure revoke_all_privileges_dcp_schema_role(dcp_schema_name NAME, role_name TEXT) IS 'Revoke all privileges to it in dcp_schema_name';

    CREATE OR REPLACE PROCEDURE drop_role_and_user_if_exists(role_name text, user_name NAME) AS $$
    BEGIN
      EXECUTE FORMAT('REASSIGN OWNED BY %I', role_name);
      EXECUTE FORMAT('DROP OWNED BY %I', role_name);
      EXECUTE FORMAT('DROP ROLE IF EXISTS %I', role_name);
      EXECUTE FORMAT('DROP USER IF EXISTS %I', user_name);
    END;$$ LANGUAGE plpgsql;
    comment on procedure drop_role_and_user_if_exists(role_name TEXT, user_name NAME) IS 'Drop the role_name/user_name if it exists after clearing dependencies';

    CREATE OR REPLACE FUNCTION ${fn.unitTest(state).qName}() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
    BEGIN 
      RETURN NEXT has_function('create_role_if_not_exists');
      RETURN NEXT has_function('create_all_privileges_dcp_schema_role');
      RETURN NEXT has_function('create_database_user_with_role');
      --RETURN NEXT has_function('create_all_privileges_views_role');
      RETURN NEXT has_function('create_read_only_privileges_dcp_schema_role');
      RETURN NEXT has_function('revoke_all_privileges_dcp_schema_role');
      RETURN NEXT has_function('drop_role_and_user_if_exists');

      --call twice without errors
      CREATE SCHEMA IF NOT EXISTS assuranceTmp1;
      CREATE OR REPLACE VIEW assuranceTmp1.assuranceView AS SELECT '1' as result;
      --RETURN NEXT has_view('assuranceView');
      CALL ${lQR("create_role_if_not_exists")}('assurance_role1');
      CALL ${lQR("create_role_if_not_exists")}('assurance_role1');
      RETURN NEXT has_role('assurance_role1');
      RETURN NEXT ok((${lQR("create_database_user_with_role")}('assurance_user1', 'password', 'assurance_role1') = 1),
      'user assurance_user1 should be created with role assurance_role1');
      RETURN NEXT has_user('assurance_user1');
      --Check ALL Privileges--
      CALL ${lQR("create_all_privileges_dcp_schema_role")}('assurancetmp1','assurance_role1');
      RETURN NEXT schema_privs_are(
      'assurancetmp1', 'assurance_user1', ARRAY['USAGE'],
      'assurance_user1 should be granted USAGE on schema "assurancetmp1"');
      --RETURN NEXT table_privs_are ( 'assurancetmp1','assuranceView', 'assurance_role1', ARRAY['SELECT','INSERT', 'UPDATE','DELETE'], 'assurance_role1 should be able to SELECT, INSERT, UPDATE and DELETE on table assuranceView' ); 
      CALL ${state.schema.qualifiedReference("revoke_all_privileges_dcp_schema_role")} ('assurancetmp1','assurance_role1');
      -- RETURN NEXT schema_privs_are(
      -- 'assurancetmp1', 'assurance_user1', ARRAY['USAGE'],
      -- 'assurance_user1 should be granted USAGE on schema "assurancetmp1"');
      -- RETURN NEXT table_privs_are ( 'assurancetmp1','assuranceView', 'assurance_role1', ARRAY['SELECT','INSERT', 'UPDATE','DELETE'], 'assurance_role1 should be able to SELECT, INSERT, UPDATE and DELETE on table assuranceView' ); 
      CALL ${lQR("drop_role_and_user_if_exists")}('assurance_role1','assurance_user1');
      RETURN NEXT hasnt_role('assurance_role1');
      RETURN NEXT hasnt_user('assurance_user1');
      DROP SCHEMA assuranceTmp1 cascade;
    END;$$;
  `;
}
