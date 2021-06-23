import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("keycloak");

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.lib,
        affinityGroup,
        extensions: [schemas.extensions.ltreeExtn, schemas.extensions.httpExtn],
      },
  );
  const [sQR, cQR, exQR, ctxQR, lQR] = state.observableQR(
    state.schema,
    schemas.confidential,
    schemas.extensions,
    schemas.context,
    schemas.lib,
  );

  const { lcFunctions: lcf } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      BEGIN CREATE DOMAIN ${cQR("keycloak_server_identity")} AS text;EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'domain "keycloak_server_identity" already exists, skipping'; END;

      CREATE TABLE IF NOT EXISTS ${cQR("keycloak_provenance")} (
        identity ${cQR("keycloak_server_identity")} NOT NULL,
        context ${ctxQR("context")} NOT NULL,
        api_base_url text NOT NULL,
        admin_username text NOT NULL,
        admin_password text NOT NULL,
        master_realm_name text NOT NULL,
        verify boolean NOT NULL,        
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        CONSTRAINT keycloak_provenance_pk UNIQUE(identity),
        CONSTRAINT keycloak_provenance_unq_row UNIQUE(identity, context)
      );    
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
    CREATE OR REPLACE FUNCTION ${lQR("get_token")}(server_url text,client_id text,master_realm_name text,realm_name text, client_secret_key text, username text, passwords text)
      RETURNS text
      AS $gettokenfn$
      from keycloak import KeycloakOpenID
      try: 
        keycloak_openid = KeycloakOpenID(server_url=server_url,
                          client_id=client_id,
                          realm_name=master_realm_name,
                          client_secret_key=client_secret_key)
        
        token = keycloak_openid.token(username, passwords)        
        return token;                 
      except Exception as error:
        return repr(error)
      $gettokenfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("userinfo")}(server_url text,client_id text,master_realm_name text,realm_name text , client_secret_key text, username text, passwords text)
      RETURNS text
      AS $userinfofn$
      from keycloak import KeycloakOpenID
      try: 
        keycloak_openid = KeycloakOpenID(server_url=server_url,
                          client_id=client_id,
                          realm_name=master_realm_name,
                          client_secret_key=client_secret_key)
        token = keycloak_openid.token(username, passwords)
        userinfo = keycloak_openid.userinfo(token[token])	
        return userinfo;                 
      except Exception as error:
        return repr(error)
      $userinfofn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("refresh_token")}(server_url text,client_id text,master_realm_name text,realm_name text , client_secret_key text, refresh_token varchar)
      RETURNS text
      AS $refreshtokenfn$
      from keycloak import KeycloakOpenID
      try: 
        keycloak_openid = KeycloakOpenID(server_url=server_url,
                          client_id=client_id,
                          realm_name=master_realm_name,
                          client_secret_key=client_secret_key)
        token = keycloak_openid.refresh_token(token[refresh_token])	
        return token;                 
      except Exception as error:
        return repr(error)
      $refreshtokenfn$ LANGUAGE plpython3u
      ;


      CREATE OR REPLACE FUNCTION ${lQR("logout")}(server_url text,client_id text,master_realm_name text,realm_name text , client_secret_key text, refresh_token varchar)
      RETURNS text
      AS $logoutfn$
      from keycloak import KeycloakOpenID
      try: 
        keycloak_openid = KeycloakOpenID(server_url=server_url,
                          client_id=client_id,
                          realm_name=master_realm_name,
                          client_secret_key=client_secret_key)
        keycloak_openid.logout(token[refresh_token])	
        return "logged out";                 
      except Exception as error:
        return repr(error)
      $logoutfn$ LANGUAGE plpython3u
      ;
      
      CREATE OR REPLACE FUNCTION dcp_lib.create_user(server_url text, admin_username text, admin_password text, master_realm_name text, realm_name text, email text, username text, value_password text, is_enabled boolean, firstname character varying, lastname character varying)
      RETURNS text      
      AS $createuserFn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm_name,                                     
                                          verify=True)    
        keycloak_admin.realm_name = realm_name                                 
        new_user = keycloak_admin.create_user({"email":email,
                              "username": username,
                              "enabled": True,
                              "firstName":firstname,
                              "lastName": lastname,
                              "credentials": [{"value": value_password,"type":  "password",}]})
        return new_user;                 
      except Exception as error:
        return repr(error)
      $createuserFn$ LANGUAGE plpython3u     ;

      


      CREATE OR REPLACE FUNCTION ${lQR("fetch_client_id")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,client_name varchar)
      RETURNS text AS $fetchclientidFn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
      client_id = keycloak_admin.get_client_id(client_name)
      return client_id; 
      $fetchclientidFn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("create_client_role")}(server_url text,admin_username text, admin_password text,master_realm_name text, realm_name text ,client_name text, role_name text)
      RETURNS text AS $createclientroleFn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                           username=admin_username,
                                           password=admin_password,
                                           realm_name=master_realm_name,
                                           verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)                                   
        keycloak_admin.create_client_role(client_id, {'name': role_name, 'clientRole': True})
        role = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)
        return role; 
      except Exception as error:
        return repr(error)
      $createclientroleFn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("get_client_role")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,client_name text, role_name text)
      RETURNS text          
      AS $getclientrolefn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                             username=admin_username,
                                             password=admin_password,
                                             realm_name=master_realm_name,
                                             verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)                
        role_id = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)   
        return role_id;  
      except Exception as error:
        return repr(error)
      $getclientrolefn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("create_group")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,group_name text)
      RETURNS text      
      AS $creategroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                             username=admin_username,
                                             password=admin_password,
                                             realm_name=master_realm_name,
                                             verify=True)
        keycloak_admin.realm_name = realm_name
        group = keycloak_admin.create_group({"name": group_name},None,True)
        return group; 
      except Exception as error:
        return repr(error)
      $creategroupfn$ LANGUAGE plpython3u;
      CREATE OR REPLACE FUNCTION ${lQR("assign_client_role")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,username text , client_name text, role_name text)
      RETURNS text
      AS $assignclientrolefn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm_name,
                                         verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)    
        user_id_keycloak = keycloak_admin.get_user_id(username)
        role_id = keycloak_admin.get_client_role_id(client_id=client_id, role_name=role_name)   
        return  "sucess";
      except Exception as error:
        return repr(error)
      $assignclientrolefn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("get_clients")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text )
      RETURNS text      
      AS $getclientsfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
      keycloak_admin.realm_name = realm_name
      clients = keycloak_admin.get_clients()
      return clients; 
      $getclientsfn$ LANGUAGE plpython3u;
      
      CREATE OR REPLACE FUNCTION ${lQR("get_client_id")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text,client_name text)
      RETURNS text      
      AS $getclientidfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      keycloak_admin = KeycloakAdmin(server_url=server_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm_name,
                                         verify=True)
      keycloak_admin.realm_name = realm_name
      client_id = keycloak_admin.get_client_id(client_name)
      return client_id; 
      $getclientidfn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("get_roles")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text )
      RETURNS text      
      AS $getrolesfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
      keycloak_admin.realm_name = realm_name
      realm_roles = keycloak_admin.get_roles()
      return realm_roles;
      $getrolesfn$ LANGUAGE plpython3u;

      CREATE OR REPLACE FUNCTION ${lQR("get_user_id")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,username text)
      RETURNS text
      AS $getuseridfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
      keycloak_admin.realm_name = realm_name   
      user_id_keycloak = keycloak_admin.get_user_id(username)
      return user_id_keycloak;
      $getuseridfn$ LANGUAGE plpython3u;    


      CREATE OR REPLACE FUNCTION ${lQR("create_realm")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text )
      RETURNS text
      AS $createrealmfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)	
        keycloak_admin.create_realm(payload={"realm": realm_name}, skip_exists=False)  
        return  "sucess";
      except Exception as error:
        return repr(error)
      $createrealmfn$ LANGUAGE plpython3u;
      

      CREATE OR REPLACE FUNCTION ${lQR("get_groups")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text)
      RETURNS text
      AS $getgroupsfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        groups = keycloak_admin.get_groups()
        return groups; 
      except Exception as error:
        return repr(error)
      $getgroupsfn$ LANGUAGE plpython3u;
      

      CREATE OR REPLACE FUNCTION ${lQR("get_client_roles_of_user")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text,client_name text, username text)
      RETURNS text
      AS $getclientrolesofuserfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        user_id_keycloak = keycloak_admin.get_user_id(username)
        roles_of_user = keycloak_admin.get_client_roles_of_user(user_id=user_id_keycloak, client_id=client_id)
        return roles_of_user; 
      except Exception as error:
        return repr(error) 
      $getclientrolesofuserfn$ LANGUAGE plpython3u;   
      
      CREATE OR REPLACE FUNCTION dcp_lib.create_client(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text , client_name text)
      RETURNS text
      AS $createclientfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        new_client = keycloak_admin.create_client({"id" : client_name},skip_exists=False)
        return new_client;                 
      except Exception as error:
        return repr(error)
      $createclientfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("create_user_with_password")}(server_url text,admin_username text, admin_password text,master_realm_name text,
      realm_name text,email text ,username text, value_password text, is_enabled boolean,firstname varchar, lastname   varchar)
      RETURNS text
      AS $createuserwithpasswordfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        new_user = keycloak_admin.create_user({"email":email,"username": username,"enabled": True,"firstName":firstname,"lastName": lastname, 
                      "credentials": [{"value": value_password,"type": "password",}]},
                        exist_ok=False)
        return new_user;                 
      except Exception as error:
        return repr(error)
      $createuserwithpasswordfn$ LANGUAGE plpython3u
      ;


      CREATE OR REPLACE FUNCTION ${lQR("update_user")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text , 
      username text,firstName varchar )
      RETURNS text
      AS $updateuserfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.update_user(user_id=user_id_keycloak, 
                                            payload={'firstName': firstName})
        return response;                 
      except Exception as error:
        return repr(error)
      $updateuserfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("update_user_password")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,  
      username text,password varchar )
      RETURNS text
      AS $updateuserpasswordfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.set_user_password(user_id=user_id_keycloak, password=password, temporary=True)
        return response;                 
      except Exception as error:
        return repr(error)
      $updateuserpasswordfn$ LANGUAGE plpython3u
      ;



      CREATE OR REPLACE FUNCTION ${lQR("send_verify_email")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,username text)
      RETURNS text
      AS $sendverifyemailfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.send_verify_email(user_id=user_id_keycloak)
        return response;                 
      except Exception as error:
        return repr(error)
      $sendverifyemailfn$ LANGUAGE plpython3u
      ;


      CREATE OR REPLACE FUNCTION ${lQR("get_client_role")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text , 
      client_name text,role_name text)
      RETURNS text
      AS $getclientrolefn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        role = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)
        return role;                 
      except Exception as error:
        return repr(error)
      $getclientrolefn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("get_client_role_id")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,
      client_name text,role_name text)
      RETURNS text
      AS $getclientroleidfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        role_id  = keycloak_admin.get_client_role_id(client_id=client_id, role_name=role_name)
        return role_id ;                 
      except Exception as error:
        return repr(error)
      $getclientroleidfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("create_group")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text , 
      group_name text)
      RETURNS text
      AS $creategroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        group = keycloak_admin.create_group(name=group_name)
        return "created group" ;                 
      except Exception as error:
        return repr(error) 
      $creategroupfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("get_groups")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text )
      RETURNS text
      AS $getgroupsfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        groups = keycloak_admin.get_groups()
        return groups;                 
      except Exception as error:
        return repr(error)
      $getgroupsfn$ LANGUAGE plpython3u
      ;

      CREATE OR REPLACE FUNCTION ${lQR("create_subgroup")}(server_url text,admin_username text, admin_password text,master_realm_name text,realm_name text ,  parent_group_name text , group_name text)
      RETURNS text
      AS $createsubgroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try: 
        keycloak_admin = KeycloakAdmin(server_url=server_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm_name,
                                        verify=True)
        keycloak_admin.realm_name = realm_name
        group = keycloak_admin.create_group(parent = parent_group_name, name=group_name)
        return group;                 
      except Exception as error:
        return repr(error)
      $createsubgroupfn$ LANGUAGE plpython3u
      ;


    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();        
        DROP FUNCTION IF EXISTS ${lQR("create_user")};
        DROP FUNCTION IF EXISTS ${lQR("fetch_client_id")};
        DROP FUNCTION IF EXISTS ${lQR("create_client_role")};
        DROP FUNCTION IF EXISTS ${lQR("get_client_role")};
        DROP FUNCTION IF EXISTS ${lQR("create_group")};
        DROP FUNCTION IF EXISTS ${lQR("assign_client_role")};
        DROP FUNCTION IF EXISTS ${lQR("get_clients")};
        DROP FUNCTION IF EXISTS ${lQR("get_client_id")};
        DROP FUNCTION IF EXISTS ${lQR("get_roles")};
        DROP FUNCTION IF EXISTS ${lQR("get_user_id")};
        DROP FUNCTION IF EXISTS ${lQR("create_realm")};
        DROP FUNCTION IF EXISTS ${lQR("get_groups")};
        DROP FUNCTION IF EXISTS ${lQR("get_token")};
        DROP FUNCTION IF EXISTS ${lQR("userinfo")};
        DROP FUNCTION IF EXISTS ${lQR("refresh_token")};
        DROP FUNCTION IF EXISTS ${lQR("logout")};
        DROP FUNCTION IF EXISTS ${lQR("create_user_with_password")};
        DROP FUNCTION IF EXISTS ${lQR("update_user")};
        DROP FUNCTION IF EXISTS ${lQR("update_user_password")};
        DROP FUNCTION IF EXISTS ${lQR("send_verify_email")};
        DROP FUNCTION IF EXISTS ${lQR("get_client_role")};
        DROP FUNCTION IF EXISTS ${lQR("get_client_role_id")};
        DROP FUNCTION IF EXISTS ${lQR("create_group")};        
		    DROP FUNCTION IF EXISTS ${lQR("create_subgroup")};
        DROP FUNCTION IF EXISTS ${lQR("get_client_roles_of_user")};
        DROP TABLE IF EXISTS ${cQR("keycloak_provenance")} CASCADE;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'keycloak_provenance');
    END;
    $$ LANGUAGE plpgsql;`;
}
