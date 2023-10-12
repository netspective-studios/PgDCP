import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export function SQLShielded(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.keycloak,
        extensions: [schemas.extensions.ltreeExtn, schemas.extensions.httpExtn],
      },
  );
  const [cQR, ctxQR, lQR] = state.observableQR(
    schemas.confidential,
    schemas.context,
    schemas.keycloak,
  );

  const { lcFunctions: lcf } = state.schema;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructStorage(state).qName}() AS $$
    BEGIN
      BEGIN CREATE DOMAIN ${cQR("keycloak_server_identity")} AS text;EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'domain "keycloak_server_identity" already exists, skipping'; END;

      CREATE TABLE IF NOT EXISTS ${cQR("keycloak_provenance")} (
        identity ${cQR("keycloak_server_identity")} NOT NULL,
        context ${ctxQR("execution_context")} NOT NULL,
        api_base_url text NOT NULL,
        admin_username text NOT NULL,
        admin_password text NOT NULL,
        master_realm text NOT NULL,
        user_realm_name text NOT NULL,
        verify boolean NOT NULL,        
        created_at timestamptz NOT NULL default current_timestamp,
        created_by name NOT NULL default current_user,
        CONSTRAINT keycloak_provenance_pk UNIQUE(identity),
        CONSTRAINT keycloak_provenance_unq_row UNIQUE(identity, context)
      );    
    END;
    $$ LANGUAGE PLPGSQL;
    DROP FUNCTION IF EXISTS ${lQR("create_user")} CASCADE;
    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
    
    DROP FUNCTION IF EXISTS ${lQR("get_client_secret")} CASCADE;
    CREATE OR REPLACE FUNCTION ${lQR("get_client_secret")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
    RETURNS json    
   AS $getclientsecretfn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try:        
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
       keycloak_admin.realm_name = user_realm_name
       client_id = keycloak_admin.get_client_id(client_name)
       response =keycloak_admin.get_client_secrets(client_id)    
       return json.dumps(response['value']);                 
     except Exception as error:
        return json.dumps(repr(error))
     $getclientsecretfn$ LANGUAGE plpython3u
   ; 

   DROP FUNCTION IF EXISTS ${lQR("update_user_email_verified_flag")} CASCADE;
   CREATE OR REPLACE FUNCTION ${lQR("update_user_email_verified_flag")}(username text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
    RETURNS json
    LANGUAGE plpython3u
    AS $function$
          import json
          from keycloak import KeycloakOpenID
          from keycloak import KeycloakAdmin
          try:         
            keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)    
            keycloak_admin.realm_name = user_realm_name
            user_id_keycloak = keycloak_admin.get_user_id(username)
            response = keycloak_admin.update_user(user_id=user_id_keycloak, 
                                                payload={"emailVerified":True})
            return json.dumps(response);                 
          except Exception as error:
            return json.dumps(repr(error))
          $function$
    ;
  
 DROP FUNCTION IF EXISTS ${lQR("update_user_details")}(username text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, firstname character varying , lastname character varying ) CASCADE;
  
 CREATE OR REPLACE FUNCTION ${lQR("update_user_details")}(username text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, firstname character varying DEFAULT NULL::character varying, lastname character varying DEFAULT NULL::character varying)
 RETURNS json
 LANGUAGE plpython3u
AS $function$
import json
from keycloak import KeycloakOpenID
from keycloak import KeycloakAdmin

try:
    keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                   username=admin_username,
                                   password=admin_password,
                                   realm_name=master_realm,
                                   verify=True)
    keycloak_admin.realm_name = user_realm_name
    user_id_keycloak = keycloak_admin.get_user_id(username)

    update_payload = {}

    if firstname is not None:
        update_payload["firstName"] = firstname
    if lastname is not None:
        update_payload["lastName"] = lastname

    if update_payload:
        response = keycloak_admin.update_user(user_id=user_id_keycloak, payload=update_payload)
        return json.dumps(response)
    else:
        return json.dumps({"message": "No updates specified."})
except Exception as error:
    return json.dumps({"error": repr(error)})
$function$
;

   DROP FUNCTION IF EXISTS ${lQR("user_info")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("user_info")}(access_token text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
      RETURNS json
      AS $userinfofn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        response =keycloak_admin.get_client_secrets(client_id)
        client_secret_key = response['value']	
        keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                          client_id=client_id,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key)        
        userinfo = keycloak_openid.userinfo(access_token)	
        return json.dumps(userinfo);                 
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $userinfofn$ LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("refresh_token")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("refresh_token")}(refresh_token varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
      RETURNS json
      AS $refreshtokenfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        response =keycloak_admin.get_client_secrets(client_id)
        client_secret_key = response['value']
        keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                          client_id=client_id,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key)
        token = keycloak_openid.refresh_token(refresh_token)	
        return json.dumps(token);                 
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $refreshtokenfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("logout")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("logout")}(refresh_token varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
      RETURNS text
      AS $logoutfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)        
        response =keycloak_admin.get_client_secrets(client_id)
        client_secret_key = response['value']	
        keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                          client_id=client_name,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key)
        keycloak_openid.logout(refresh_token)	
        return "logged out";                 
      except Exception as error:
        return repr(error)
      $logoutfn$ LANGUAGE plpython3u
      ;


      DROP FUNCTION IF EXISTS ${lQR("user_logout")} CASCADE;
     CREATE OR REPLACE FUNCTION ${lQR("user_logout")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS json
     AS $sendverifyemailfn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
       keycloak_admin.realm_name = user_realm_name
       user_id_keycloak = keycloak_admin.get_user_id(username)
       response = keycloak_admin.user_logout(user_id=user_id_keycloak)
       return json.dumps(response);                 
     except Exception as error:
       return json.dumps(repr(error))
     $sendverifyemailfn$ LANGUAGE plpython3u
     ;


      DROP FUNCTION IF EXISTS ${lQR("create_user")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_user")}(email text, username text, value_password text,  firstname character varying, lastname character varying,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS text      
      AS $createuserFn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name                                
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

      DROP FUNCTION IF EXISTS ${lQR("create_client_role")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_client_role")}(role_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
      RETURNS json AS $createclientroleFn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)                                   
        keycloak_admin.create_client_role(client_id, {'name': role_name, 'clientRole': True})
        role = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)
        return json.dumps(role); 
      except Exception as error:
        return json.dumps(repr(error))
      $createclientroleFn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("get_client_role")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_client_role")}(role_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
      RETURNS json          
      AS $getclientrolefn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name            
        client_id = keycloak_admin.get_client_id(client_name)                
        role_id = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)   
        return json.dumps(role_id);
      except Exception as error:
        return json.dumps(repr(error))
      $getclientrolefn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("create_group")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_group")}(group_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS text      
      AS $creategroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        group = keycloak_admin.create_group({"name": group_name})
        allgroups = keycloak_admin.get_groups()
        for s in range(len(allgroups)):
            if allgroups[s]["name"] == group_name:
              groupid = allgroups[s]["id"]
        return groupid; 
      except Exception as error:
        return repr(error)
      $creategroupfn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("create_group_service")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_group_service")}(group_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS text      
      AS $creategroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        group = keycloak_admin.create_group({"name": group_name,"attributes":{"Service":["True"]}})
        allgroups = keycloak_admin.get_groups()
        for s in range(len(allgroups)):
            if allgroups[s]["name"] == group_name:
              groupid = allgroups[s]["id"]
        return groupid; 
      except Exception as error:
        return repr(error)
      $creategroupfn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("assign_client_role")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("assign_client_role")}(username text ,  role_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
      RETURNS text
      AS $assignclientrolefn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)    
        user_id_keycloak = keycloak_admin.get_user_id(username)
        role_id = keycloak_admin.get_client_role_id(client_id=client_id, role_name=role_name) 
        keycloak_admin.assign_client_role( user_id=user_id_keycloak, client_id=client_id,roles=[{"id":role_id ,"name": role_name}])  
        return  "success";
      except Exception as error:
        return repr(error)
      $assignclientrolefn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("get_clients")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_clients")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json      
      AS $getclientsfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
      keycloak_admin.realm_name = user_realm_name
      clients = keycloak_admin.get_clients()
      return json.dumps(clients); 
      $getclientsfn$ LANGUAGE plpython3u;
      
      DROP FUNCTION IF EXISTS ${lQR("get_client_id")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_client_id")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
      RETURNS json      
      AS $getclientidfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
      keycloak_admin.realm_name = user_realm_name
      client_id = keycloak_admin.get_client_id(client_name)
      return json.dumps(client_id); 
      $getclientidfn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("get_roles")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_roles")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ,client_name text)
      RETURNS json      
      AS $getrolesfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
      keycloak_admin.realm_name = user_realm_name
      client_id = keycloak_admin.get_client_id(client_name)
      realm_roles = keycloak_admin.get_client_roles(client_id=client_id)
      return json.dumps(realm_roles);
      $getrolesfn$ LANGUAGE plpython3u;

      DROP FUNCTION IF EXISTS ${lQR("get_user_id")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_user_id")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS text
      AS $getuseridfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
      keycloak_admin.realm_name = user_realm_name
      user_id_keycloak = keycloak_admin.get_user_id(username)
      return user_id_keycloak;
      $getuseridfn$ LANGUAGE plpython3u;    

      DROP FUNCTION IF EXISTS ${lQR("create_realm")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_realm")}(realm_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS text
      AS $createrealmfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)
        keycloak_admin.create_realm(payload={"realm": user_realm_name}, skip_exists=False)  
        return  "success";
      except Exception as error:
        return repr(error)
      $createrealmfn$ LANGUAGE plpython3u;
      
      DROP FUNCTION IF EXISTS ${lQR("get_groups")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_groups")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      AS $getgroupsfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        groups = keycloak_admin.get_groups()
        return json.dumps(groups); 
      except Exception as error:
        return json.dumps(repr(error))
      $getgroupsfn$ LANGUAGE plpython3u;
      
      DROP FUNCTION IF EXISTS ${lQR("get_client_roles_of_user")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_client_roles_of_user")}( username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
      RETURNS json
      AS $getclientrolesofuserfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        user_id_keycloak = keycloak_admin.get_user_id(username)
        roles_of_user = keycloak_admin.get_client_roles_of_user(user_id=user_id_keycloak, client_id=client_id)
        return json.dumps(roles_of_user); 
      except Exception as error:
        return json.dumps(repr(error)) 
      $getclientrolesofuserfn$ LANGUAGE plpython3u;   
      
      DROP FUNCTION IF EXISTS ${lQR("create_client")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_client")}( api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
      RETURNS text
      AS $createclientfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        new_client = keycloak_admin.create_client({"id" : client_name,"directAccessGrantsEnabled" : True },skip_exists=False)
        keycloak_admin.generate_client_secrets(client_name)
        return "client created";                 
      except Exception as error:
        return repr(error)
      $createclientfn$ LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("create_user_with_password")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_user_with_password")}(email text ,username text, value_password text, is_enabled boolean,firstname varchar, lastname   varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      AS $createuserwithpasswordfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        new_user = keycloak_admin.create_user({"email":email,"username": username,"enabled": True,"firstName":firstname,"lastName": lastname, 
                      "credentials": [{"value": value_password,"type": "password",}]},
                        exist_ok=False)
        return json.dumps(new_user);                 
      except Exception as error:
        return json.dumps(repr(error))
      $createuserwithpasswordfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("update_user")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("update_user")}(username text,firstname varchar ,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      AS $updateuserfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.update_user(user_id=user_id_keycloak, 
                                            payload={"firstName": firstname})
        return json.dumps(response);                 
      except Exception as error:
        return json.dumps(repr(error))
      $updateuserfn$ LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("update_user_password")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("update_user_password")}(username text,password varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS json
      AS $updateuserpasswordfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.set_user_password(user_id=user_id_keycloak, password=password, temporary=True)
        return json.dumps(response);                 
      except Exception as error:
        return json.dumps(repr(error))
      $updateuserpasswordfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("update_user_password_permanent")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("update_user_password_permanent")}(username text,password varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
      RETURNS json
      AS $updateuserpasswordfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.set_user_password(user_id=user_id_keycloak, password=password, temporary=False)
        return json.dumps(response);                 
      except Exception as error:
        return json.dumps(repr(error))
      $updateuserpasswordfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("enable_user_account")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("enable_user_account")}(username text,  api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
      RETURNS json
      LANGUAGE plpython3u
      AS $function$
        import json
        from keycloak import KeycloakOpenID
        from keycloak import KeycloakAdmin
        try:         
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                            username=admin_username,
                                            password=admin_password,
                                            realm_name=master_realm,                                     
                                            verify=True)    
          keycloak_admin.realm_name = user_realm_name
          user_id_keycloak = keycloak_admin.get_user_id(username)
          response = keycloak_admin.update_user(user_id=user_id_keycloak, 
                                              payload={"enabled": True, "emailVerified": True})
          return json.dumps(response);                 
        except Exception as error:
          return json.dumps(repr(error))
        $function$
      ;
          
      DROP FUNCTION IF EXISTS ${lQR("create_user_with_attributes")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_user_with_attributes")}(email text, username text, value_password text, firstname character varying, lastname character varying, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, user_attributes json)
      RETURNS json
      LANGUAGE plpython3u
      AS $function$
          import json
          from keycloak import KeycloakOpenID
          from keycloak import KeycloakAdmin
          try: 
            
            keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)    
            keycloak_admin.realm_name = user_realm_name                                
            new_user = keycloak_admin.create_user({"email":email,
                                  "username": username,
                                  "enabled": True,
                                  "firstName":firstname,
                                  "lastName": lastname,
                                  "credentials": [{"value": value_password,"type":  "password"}],
                                  "attributes":json.loads(user_attributes)})
            return json.dumps(new_user);                 
          except Exception as error:
            return json.dumps(repr(error))
          $function$
      ;
          
      DROP FUNCTION IF EXISTS ${lQR("create_disabled_user_with_attributes")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_disabled_user_with_attributes")}(email text, username text, value_password text, firstname character varying, lastname character varying, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, user_attributes json)
      RETURNS json
      LANGUAGE plpython3u
      AS $function$
          import json
          from keycloak import KeycloakOpenID
          from keycloak import KeycloakAdmin
          try: 
            
            keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)    
            keycloak_admin.realm_name = user_realm_name                                
            new_user = keycloak_admin.create_user({"email":email,
                                  "username": username,
                                  "enabled": False,
                                  "firstName":firstname,
                                  "lastName": lastname,
                                  "credentials": [{"value": value_password,"type":  "password"}],
                                  "attributes":json.loads(user_attributes)})
            return json.dumps(new_user);                 
          except Exception as error:
            return json.dumps(repr(error))
          $function$
      ;


      DROP FUNCTION IF EXISTS ${lQR("send_verify_email")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("send_verify_email")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS text
      AS $sendverifyemailfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        response = keycloak_admin.send_verify_email(user_id=user_id_keycloak)
        return "Mail send";                 
      except Exception as error:
        return repr(error)
      $sendverifyemailfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("get_client_role")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_client_role")}(role_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ,client_name text)
      RETURNS json
      AS $getclientrolefn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        role = keycloak_admin.get_client_role(client_id=client_id, role_name=role_name)
        return json.dumps(role);                 
      except Exception as error:
        return json.dumps(repr(error))
      $getclientrolefn$ LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("get_client_role_id")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_client_role_id")}(role_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
      RETURNS json
      AS $getclientroleidfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        client_id = keycloak_admin.get_client_id(client_name)
        role_id  = keycloak_admin.get_client_role_id(client_id=client_id, role_name=role_name)
        return json.dumps(role_id);                 
      except Exception as error:
        return json.dumps(repr(error))
      $getclientroleidfn$ LANGUAGE plpython3u
      ;

      
      DROP FUNCTION IF EXISTS ${lQR("get_groups")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_groups")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      AS $getgroupsfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        groups = keycloak_admin.get_groups()
        return json.dumps(groups);                 
      except Exception as error:
        return json.dumps(repr(error))
      $getgroupsfn$ LANGUAGE plpython3u
      ;

      DROP FUNCTION IF EXISTS ${lQR("create_subgroup")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_subgroup")}(parent_group_name text, group_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS text      
      AS $createsubgroupfn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:           
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                      username=admin_username,
                      password=admin_password,
                      realm_name=master_realm,
                      verify=True) 
        keycloak_admin.realm_name = user_realm_name
        try:
         add_group = keycloak_admin.create_group({"name": parent_group_name})
        except Exception as errors:
          err = repr(errors)
        allgroups = keycloak_admin.get_groups()
        for s in range(len(allgroups)):
          if allgroups[s]["name"] == parent_group_name:
            grp = allgroups[s]["id"]
        group = keycloak_admin.create_group(parent=  grp, payload={"name": group_name}, skip_exists=False)
        return group
      except Exception as error:
        return repr(error)
      $createsubgroupfn$ LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("create_invite_user")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("create_invite_user")}  (email text, username text,  firstname character varying, lastname character varying, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
      RETURNS text AS $createinviteuserFn$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name                                
        new_user = keycloak_admin.create_user({"email":email,
                              "username": username,
                              "enabled": True,
                              "firstName":firstname,
                              "lastName": lastname})
        return new_user;                 
      except Exception as error:
        return repr(error)
      $createinviteuserFn$ LANGUAGE plpython3u ;

      DROP FUNCTION IF EXISTS ${lQR("group_user_add")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("group_user_add")}(parent_group_name text,user_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ) 
      RETURNS text       
      AS $groupuseraddfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:           
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                      username=admin_username,
                      password=admin_password,
                      realm_name=master_realm,
                      verify=True) 
          keycloak_admin.realm_name = user_realm_name
          allgroups = keycloak_admin.get_groups()
          for s in range(len(allgroups)):
            if allgroups[s]["name"] == parent_group_name:
              groupid = allgroups[s]["id"]
          user_id_keycloak = keycloak_admin.get_user_id(user_name)
          keycloak_admin.group_user_add(user_id=user_id_keycloak, group_id=groupid)
          return 'user added to group'
      except Exception as error:
        return repr(error)
      $groupuseraddfn$ LANGUAGE plpython3u 
      ;
      DROP FUNCTION IF EXISTS ${lQR("group_user_remove")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("group_user_remove")}(parent_group_name text,userid text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ) 
      RETURNS text       
      AS $groupuserremovefn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      try: 
          
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                      username=admin_username,
                      password=admin_password,
                      realm_name=master_realm,
                      verify=True) 
          keycloak_admin.realm_name = user_realm_name
          allgroups = keycloak_admin.get_groups()
          for s in range(len(allgroups)):
            if allgroups[s]["name"] == parent_group_name:
              groupid = allgroups[s]["id"]
          user_id_keycloak = keycloak_admin.get_user_id(userid)
          keycloak_admin.group_user_remove(user_id=user_id_keycloak, group_id=groupid)
          return 'user removed from group'
      except Exception as error:
          return repr(error)
      $groupuserremovefn$ LANGUAGE plpython3u 
      ;
      DROP FUNCTION IF EXISTS ${lQR("delete_group")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("delete_group")}(parent_group_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ) 
      RETURNS text       
      AS $deletegroupfn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      try: 
          
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                      username=admin_username,
                      password=admin_password,
                      realm_name=master_realm,
                      verify=True) 
          keycloak_admin.realm_name = user_realm_name
          allgroups = keycloak_admin.get_groups()
          for s in range(len(allgroups)):
            if allgroups[s]["name"] == parent_group_name:
              groupid = allgroups[s]["id"]
          keycloak_admin.delete_group(group_id=groupid)
          return grp
      except Exception as error:
          return repr(error)
      $deletegroupfn$ LANGUAGE plpython3u 
      ;
      DROP FUNCTION IF EXISTS ${lQR("subgroup_user_add")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("subgroup_user_add")}(group_name text,subgroup_name text, user_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      LANGUAGE plpython3u
      AS $subgroupuseraddfn$
        import json
        from keycloak import KeycloakOpenID
        from keycloak import KeycloakAdmin
        try: 
            
            keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                        username=admin_username,
                        password=admin_password,
                        realm_name=master_realm,
                        verify=True) 
            keycloak_admin.realm_name = user_realm_name
            allgroups = keycloak_admin.get_groups()
            for s in range(len(allgroups)):
              if allgroups[s]["name"] == group_name:
                for t in range(len(allgroups[s]["subGroups"])):
                  if allgroups[s]["subGroups"][t]["name"] == subgroup_name:
                    subgroupid = allgroups[s]["subGroups"][t]["id"]
            user_id_keycloak = keycloak_admin.get_user_id(user_name)
            keycloak_admin.group_user_add(user_id=user_id_keycloak, group_id=subgroupid)
            return json.dumps("sucess") 
        except Exception as error:
            return json.dumps(repr(error))
        $subgroupuseraddfn$
      ;
      DROP FUNCTION IF EXISTS ${lQR("subgroup_user_remove")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("subgroup_user_remove")}(group_name text,subgroup_name text, user_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      LANGUAGE plpython3u
     AS $subgroupuserremovefun$
        import json
        from keycloak import KeycloakOpenID
        from keycloak import KeycloakAdmin
        try: 
            
            keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                        username=admin_username,
                        password=admin_password,
                        realm_name=master_realm,
                        verify=True) 
            keycloak_admin.realm_name = user_realm_name
            allgroups = keycloak_admin.get_groups()
            for s in range(len(allgroups)):
              if allgroups[s]["name"] == group_name:
                for t in range(len(allgroups[s]["subGroups"])):
                  if allgroups[s]["subGroups"][t]["name"] == subgroup_name:
                    subgroupid = allgroups[s]["subGroups"][t]["id"]
            user_id_keycloak = keycloak_admin.get_user_id(user_name)
            keycloak_admin.group_user_remove(user_id=user_id_keycloak, group_id=subgroupid)
            return json.dumps("sucess") 
        except Exception as error:
            return json.dumps(repr(error))
        $subgroupuserremovefun$
     ;
     DROP FUNCTION IF EXISTS ${lQR("introspect")} CASCADE;
      CREATE OR REPLACE FUNCTION  ${lQR("introspect")}(access_token text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ,client_name text, clientid text)
      RETURNS json
      LANGUAGE plpython3u
      AS $introspectfn$
        import json
        from keycloak import KeycloakOpenID
        from keycloak import KeycloakAdmin
        try:           
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                          username=admin_username,
                          password=admin_password,
                          realm_name=master_realm,
                          verify=True)    
          keycloak_admin.realm_name = user_realm_name
          response =keycloak_admin.get_client_secrets(clientid)
          client_secret_key = response['value']
          keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                         client_id=client_name,
                         realm_name=user_realm_name,
                         client_secret_key=client_secret_key) 
          token_info = keycloak_openid.introspect(access_token)
          return json.dumps(token_info)                 
        except Exception as error:
          return json.dumps(repr(error))
        $introspectfn$
      ;
      DROP FUNCTION IF EXISTS ${lQR("get_users")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_users")}(api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
      LANGUAGE plpython3u
      AS $getusersfn$
         import json
         from keycloak import KeycloakOpenID
         from keycloak import KeycloakAdmin
         try: 
                    
           keycloak_admin = KeycloakAdmin(server_url=api_base_url,
              username=admin_username,
              password=admin_password,
              realm_name=master_realm,
              verify=True)    
           keycloak_admin.realm_name = user_realm_name
           users = keycloak_admin.get_users({})
           return json.dumps(users)                 
         except Exception as error:
           return json.dumps(repr(error))
         $getusersfn$
     ;

     DROP FUNCTION IF EXISTS ${lQR("update_user_openai_token")} CASCADE;
     CREATE OR REPLACE FUNCTION ${lQR("update_user_openai_token")}(username text, openai_token text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 RETURNS json
 LANGUAGE plpython3u
AS $function$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try: 
             
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
           username=admin_username,
           password=admin_password,
           realm_name=master_realm,                                     
           verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         response = keycloak_admin.update_user(user_id=user_id_keycloak,payload={ "attributes": {
                           "openai_token": openai_token
                         }})
         return json.dumps(response);                 
       except Exception as error:
         return json.dumps(repr(error))
       $function$
;
     DROP FUNCTION IF EXISTS ${lQR("update_user_git_token")} CASCADE;
     CREATE OR REPLACE FUNCTION ${lQR("update_user_git_token")}(username text, git_token text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
     RETURNS json
     AS $usergittokenfn$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try: 
             
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
           username=admin_username,
           password=admin_password,
           realm_name=master_realm,                                     
           verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         response = keycloak_admin.update_user(user_id=user_id_keycloak,payload={ "attributes": {
                           "git_token": git_token
                         }})
         return json.dumps(response);                 
       except Exception as error:
         return json.dumps(repr(error))
       $usergittokenfn$ LANGUAGE plpython3u
     ;
     DROP FUNCTION IF EXISTS ${lQR("user_details")} CASCADE;
     CREATE OR REPLACE FUNCTION ${lQR("user_details")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
     RETURNS json
    AS $function$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try: 
             
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
         username=admin_username,
         password=admin_password,
         realm_name=master_realm,                                     
         verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         user = keycloak_admin.get_user(user_id_keycloak)
         return json.dumps(user);                 
       except Exception as error:
         return json.dumps(repr(error))
       $function$ 
       LANGUAGE plpython3u
    ;

    DROP FUNCTION IF EXISTS ${lQR("user_gittoken")} CASCADE;
    CREATE OR REPLACE FUNCTION ${lQR("user_gittoken")} (username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
    RETURNS json
    AS $usergittokenfn$
    import json
    from keycloak import KeycloakOpenID
    from keycloak import KeycloakAdmin
    try:      
          
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
         username=admin_username,
         password=admin_password,
         realm_name=master_realm,                                     
         verify=True)    
      keycloak_admin.realm_name = user_realm_name
      user_id_keycloak = keycloak_admin.get_user_id(username)
      user = keycloak_admin.get_user(user_id_keycloak)
      git_token = user['attributes']['git_token']
      return json.dumps(git_token);                 
    except Exception as error:
      return json.dumps(repr(error))
    $usergittokenfn$  LANGUAGE plpython3u;  


    DROP FUNCTION IF EXISTS ${lQR("get_user_openai_token")} CASCADE;
    CREATE OR REPLACE FUNCTION ${lQR("get_user_openai_token")} (username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
    RETURNS json
    AS $usergittokenfn$
    import json
    from keycloak import KeycloakOpenID
    from keycloak import KeycloakAdmin
    try:      
          
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
         username=admin_username,
         password=admin_password,
         realm_name=master_realm,                                     
         verify=True)    
      keycloak_admin.realm_name = user_realm_name
      user_id_keycloak = keycloak_admin.get_user_id(username)
      user = keycloak_admin.get_user(user_id_keycloak)
      openai_token = user['attributes']['openai_token']
      return json.dumps(openai_token);                 
    except Exception as error:
      return json.dumps(repr(error))
    $usergittokenfn$  LANGUAGE plpython3u;  

    DROP FUNCTION IF EXISTS ${lQR("get_groupid")} CASCADE;
    CREATE OR REPLACE FUNCTION ${lQR("get_groupid")}(group_name text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
    RETURNS text
   AS $getgroupidFn$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        allgroups = keycloak_admin.get_groups()
        for s in range(len(allgroups)):
            if allgroups[s]["name"] == group_name:
              groupid = allgroups[s]["id"]
        return groupid; 
      except Exception as error:
        return repr(error)
      $getgroupidFn$ LANGUAGE plpython3u
   ;
   DROP FUNCTION IF EXISTS ${lQR("get_subgroupid")} CASCADE;
   CREATE OR REPLACE FUNCTION ${lQR("get_subgroupid")}(group_name text,subgroup_name text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 RETURNS text 
AS $getsubgroupidFn$
   from keycloak import KeycloakOpenID
   from keycloak import KeycloakAdmin
   try:        
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                       username=admin_username,
                                       password=admin_password,
                                       realm_name=master_realm,                                     
                                       verify=True)    
     keycloak_admin.realm_name = user_realm_name
     allgroups = keycloak_admin.get_groups()
     for s in range(len(allgroups)):
           if allgroups[s]["name"] == group_name:
             for t in range(len(allgroups[s]["subGroups"])):
               if allgroups[s]["subGroups"][t]["name"] == subgroup_name:
                 subgroupid = allgroups[s]["subGroups"][t]["id"]
     return subgroupid; 
   except Exception as error:
     return repr(error)
   $getsubgroupidFn$ LANGUAGE plpython3u
;

DROP FUNCTION IF EXISTS ${lQR("service_groups")} CASCADE;
CREATE OR REPLACE FUNCTION ${lQR("service_groups")} (api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 returns json
AS $servicegroupsFn$
   import json
   from keycloak import KeycloakOpenID
   from keycloak import KeycloakAdmin
   try:        
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                    username=admin_username,
                                    password=admin_password,
                                    realm_name=master_realm,                                     
                                    verify=True)    
     keycloak_admin.realm_name = user_realm_name
     allgroups = keycloak_admin.get_groups()
     res=[]
     all_count = 0
     res_count = 0
     for s in range(len(allgroups)):
       subgroupid = allgroups[s]["id"]
       al = keycloak_admin.get_group(group_id= subgroupid) 
       all_count = all_count + 1
       if  len(al['attributes']) != 0 and len(al['attributes']['Service']) > 0  and al['attributes']['Service'][0]=='True':
       	rs_js = {"id":subgroupid,"name":allgroups[s]["name"]}
       	res.append(rs_js)
       	res_count = res_count+1
     return json.dumps(res);
   except Exception as error:
     return repr(error)
   $servicegroupsFn$   LANGUAGE plpython3u;

   DROP FUNCTION IF EXISTS ${lQR("get_group_institutions")} CASCADE;
CREATE OR REPLACE FUNCTION ${lQR("get_group_institutions")} (api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 returns json
AS $getgroupinstitutionsFn$
   import json
   from keycloak import KeycloakOpenID
   from keycloak import KeycloakAdmin
   try:        
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                        username=admin_username,
                        password=admin_password,
                        realm_name=master_realm,                                     
                        verify=True)    
     keycloak_admin.realm_name = user_realm_name
     allgroups = keycloak_admin.get_groups()
     res=[]
     for s in range(len(allgroups)):
       subgroupid = allgroups[s]["id"]
       al = keycloak_admin.get_group(group_id= subgroupid) 
       if  len(al['subGroups']) > 0:
       	res.append(al)
     return json.dumps(res);
   except Exception as error:
     return repr(error)   
   $getgroupinstitutionsFn$  LANGUAGE plpython3u
;

DROP FUNCTION IF EXISTS ${lQR("get_users_list")} CASCADE;
CREATE OR REPLACE FUNCTION ${lQR("get_users_list")}(api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, client_name text)
 RETURNS json
AS $getuserslistFn$
import json
from keycloak import KeycloakOpenID
from keycloak import KeycloakAdmin
try:   
  keycloak_admin = KeycloakAdmin(server_url=api_base_url,
     username=admin_username,
     password=admin_password,
     realm_name=master_realm,
     verify=True)
  keycloak_admin.realm_name = user_realm_name
  users = keycloak_admin.get_users()
  client_id = keycloak_admin.get_client_id(client_name)
  res=[]
  result_set=[]
  for u in range(len(users)):
  	user_id = users[u]["id"]
  	user_name = users[u]["username"]
  	rs_js = {"id":user_id,"username":user_name}
  	res.append(rs_js)
  	for r in range(len(res)):
  	 uname = res[r]["username"]
  	 user_id_keycloak = keycloak_admin.get_user_id(uname)
  	 roles_of_user = keycloak_admin.get_client_roles_of_user(user_id=user_id_keycloak, client_id=client_id) 	      
  	 res_1 = (roles_of_user)
  	 for i in range(len(res_1)):
  	  role_id = {"id":user_id,"username":user_name,"firstname":users[u]["firstName"],"lastname":users[u]["lastName"],"enabled":users[u]["enabled"],"role":res_1[i]["name"]}
  	result_set.append(role_id)
  return json.dumps(result_set);
except Exception as error:
  return json.dumps(repr(error))
$getuserslistFn$ 
LANGUAGE plpython3u
;
DROP FUNCTION IF EXISTS ${lQR("get_realms")} CASCADE;
CREATE OR REPLACE FUNCTION ${lQR("get_realms")} (api_base_url text, admin_username text, admin_password text,  master_realm text)
 RETURNS json
AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin      
      keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,
                                        verify=True)
      realms = keycloak_admin.get_realms()
      return json.dumps(realms);
      $function$ 
 LANGUAGE plpython3u
;
DROP FUNCTION IF EXISTS ${lQR("user_realm_role_info")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("user_realm_role_info")} (user_name text,realm text,api_base_url text, admin_username text, admin_password text,  master_realm text)
      RETURNS json
      AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)
        keycloak_admin.realm_name = realm
        userid = keycloak_admin.get_user_id(user_name)
        response =keycloak_admin.get_realm_roles_of_user(userid)  	
        return json.dumps(response);    
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $function$ 
      LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("get_user")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_user")} (user_name text,realm text,api_base_url text, admin_username text, admin_password text,  master_realm text)
      RETURNS json
      AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)
        keycloak_admin.realm_name = realm
        userid = keycloak_admin.get_user_id(user_name)
        response =keycloak_admin.get_user(userid)  	
        return json.dumps(response);    
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $function$ 
      LANGUAGE plpython3u
      ;
      DROP FUNCTION IF EXISTS ${lQR("get_user_from_userid")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("get_user_from_userid")} (userid text,realm text,api_base_url text, admin_username text, admin_password text,  master_realm text)
      RETURNS json
      AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                              username=admin_username,
                                              password=admin_password,
                                              realm_name=master_realm,                                     
                                              verify=True)
        keycloak_admin.realm_name = realm
        response =keycloak_admin.get_user(userid)  	
        return json.dumps(response["email"]);    
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $function$ 
      LANGUAGE plpython3u
      ;
 
      DROP FUNCTION IF EXISTS ${lQR("update_user_git_user_id")} CASCADE;
CREATE OR REPLACE FUNCTION ${lQR("update_user_git_user_id")} (username text, git_user_id text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 RETURNS json
AS $function$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try: 
             
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
           username=admin_username,
           password=admin_password,
           realm_name=master_realm,                                     
           verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         response = keycloak_admin.update_user(user_id=user_id_keycloak,payload={ "attributes": {
                           "git_user_id": git_user_id
                         }})
         return json.dumps(response);                 
       except Exception as error:
         return json.dumps(repr(error))
       $function$ 
 LANGUAGE plpython3u
;

DROP FUNCTION IF EXISTS ${lQR("get_user_groups")}() CASCADE; 	  
CREATE OR REPLACE FUNCTION ${lQR("get_user_groups")}(user_id uuid, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 RETURNS text
 LANGUAGE plpython3u
AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_groups = keycloak_admin.get_user_groups(user_id)
        if len(user_groups) > 0:
         response = user_groups[0]["id"];
         return user_groups[0]["id"]
      except Exception as error:
        return json.dumps(repr(error))
      $function$
;

DROP FUNCTION IF EXISTS ${lQR("get_user_group_details")}() CASCADE; 	  
CREATE OR REPLACE FUNCTION ${lQR("get_user_group_details")}(user_id uuid, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
 RETURNS text
 LANGUAGE plpython3u
AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_groups = keycloak_admin.get_user_groups(user_id)
        if len(user_groups) > 0:
         for i in range(len(user_groups)):
          user_group = {"id":user_groups[i]["id"],"name":user_groups[i]["name"]}
          return json.dumps(user_group)
      except Exception as error:
        return json.dumps(repr(error))
      $function$
;

      DROP FUNCTION IF EXISTS ${lQR("assign_realm_roles")} CASCADE;
      CREATE OR REPLACE FUNCTION ${lQR("assign_realm_roles")}(username text, role_name text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, client_name text)
      RETURNS text
      AS $assignrealmroles$
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:        
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,
                                          verify=True)    
        keycloak_admin.realm_name = user_realm_name
        user_id_keycloak = keycloak_admin.get_user_id(username)
        role_id = keycloak_admin.get_realm_role(role_name=role_name)
        keycloak_admin.assign_realm_roles( user_id=user_id_keycloak,  roles=[{"id":role_id["id"] ,"name": role_id["name"]}])
        return  'success';
      except Exception as error:
        return repr(error)
      $assignrealmroles$ LANGUAGE plpython3u;


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
export function SQLAnonymous(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.keycloakAnonymous,
        extensions: [schemas.extensions.ltreeExtn, schemas.extensions.httpExtn],
      },
  );
  const [sQR, cQR, exQR, ctxQR, kaQR] = state.observableQR(
    state.schema,
    schemas.confidential,
    schemas.extensions,
    schemas.context,
    schemas.keycloakAnonymous,
  );

  const { lcFunctions: lcf } = state.schema;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
    
    DROP FUNCTION IF EXISTS ${kaQR("get_token")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("get_token")}(username text, passwords text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text )
     RETURNS json
     AS $gettokenfn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
       keycloak_admin.realm_name = user_realm_name
       client_id = keycloak_admin.get_client_id(client_name)
       response =keycloak_admin.get_client_secrets(client_id)
       client_secret_key = response['value']
       keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                         client_id=client_id,
                         realm_name=user_realm_name,
                         client_secret_key=client_secret_key)                      
       token = keycloak_openid.token(username, passwords, scope="openid")       
       return json.dumps(token)                 
     except Exception as error:
       return json.dumps(json.loads(error.args[0]))
     $gettokenfn$ LANGUAGE plpython3u
     ;
     DROP FUNCTION IF EXISTS ${kaQR("get_token_realm_access")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("get_token_realm_access")}(access_code text, redirecturl text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, client_name text, clientid text)
 RETURNS json
AS $get_token_realm_access$
   import json
   from keycloak import KeycloakOpenID
   from keycloak import KeycloakAdmin
   try:         
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                      username=admin_username,
                                      password=admin_password,
                                      realm_name=master_realm,                                     
                                      verify=True)    
     keycloak_admin.realm_name = user_realm_name
     response = keycloak_admin.get_client_secrets(clientid)
     client_secret_key = response['value']
     keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                       client_id=client_name,
                       realm_name=user_realm_name,
                       client_secret_key=client_secret_key)        
     token = keycloak_openid.token(code=access_code, grant_type=["authorization_code"],redirect_uri=redirecturl)       
     return json.dumps(token)                 
   except Exception as error:
     return json.dumps(json.loads(error.args[0]))
   $get_token_realm_access$  LANGUAGE plpython3u
;

     DROP FUNCTION IF EXISTS ${kaQR("refresh_token")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("refresh_token")}(refresh_token varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text)
     RETURNS json
     AS $refreshtokenfn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                        username=admin_username,
                                        password=admin_password,
                                        realm_name=master_realm,                                     
                                        verify=True)    
       keycloak_admin.realm_name = user_realm_name
       client_id = keycloak_admin.get_client_id(client_name)
       response =keycloak_admin.get_client_secrets(client_id)
       client_secret_key = response['value']
       keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                         client_id=client_id,
                         realm_name=user_realm_name,
                         client_secret_key=client_secret_key)
       token = keycloak_openid.refresh_token(refresh_token)	
       return json.dumps(token);                 
     except Exception as error:
       return json.dumps(json.loads(error.args[0]))
     $refreshtokenfn$ LANGUAGE plpython3u
     ;

     
     DROP FUNCTION IF EXISTS ${kaQR("send_verify_email")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("send_verify_email")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS json
     AS $sendverifyemailfn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
       keycloak_admin.realm_name = user_realm_name
       user_id_keycloak = keycloak_admin.get_user_id(username)
       response = keycloak_admin.send_verify_email(user_id=user_id_keycloak)
       return json.dumps(response);                 
     except Exception as error:
       return json.dumps(repr(error))
     $sendverifyemailfn$ LANGUAGE plpython3u
     ;
     DROP FUNCTION IF EXISTS ${kaQR("get_token_otp")} CASCADE;
   CREATE OR REPLACE FUNCTION ${kaQR("get_token_otp")}(username text, passwords text,totp_code text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text)
   RETURNS json
   AS $gettokenfn$
   import json
   from keycloak import KeycloakOpenID
   from keycloak import KeycloakAdmin
   try:       
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                      username=admin_username,
                                      password=admin_password,
                                      realm_name=master_realm,                                     
                                      verify=True)    
     keycloak_admin.realm_name = user_realm_name
     client_id = keycloak_admin.get_client_id(client_name)
     response =keycloak_admin.get_client_secrets(client_id)
     client_secret_key = response['value']
     keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                       client_id=client_id,
                       realm_name=user_realm_name,
                       client_secret_key=client_secret_key)        
     token = keycloak_openid.token(username, passwords, totp=totp_code)        
     return json.dumps(token)                 
   except Exception as error:
     return json.dumps(json.loads(error.args[0]))
   $gettokenfn$ LANGUAGE plpython3u
   ;

   DROP FUNCTION IF EXISTS ${kaQR("forgot_password")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("forgot_password")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS text      
     AS $forgotpasswordfn$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try:           
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                 username=admin_username,
                 password=admin_password,
                 realm_name=master_realm,                                     
                 verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         response = keycloak_admin.send_update_account(user_id=user_id_keycloak,payload=["UPDATE_PASSWORD"])
         return 'Email Sent'               
       except Exception as error:
         return repr(error)
       $forgotpasswordfn$ LANGUAGE plpython3u ;

     DROP FUNCTION IF EXISTS ${kaQR("forgot_password_with_redirect_uri")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("forgot_password_with_redirect_uri")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ,life_span int,redirect_url text)
     RETURNS text      
     AS $forgotpasswordwithredirecturifn$
       import json
       from keycloak import KeycloakOpenID
       from keycloak import KeycloakAdmin
       try:           
         keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                 username=admin_username,
                 password=admin_password,
                 realm_name=master_realm,                                     
                 verify=True)    
         keycloak_admin.realm_name = user_realm_name
         user_id_keycloak = keycloak_admin.get_user_id(username)
         response = keycloak_admin.send_update_account(user_id=user_id_keycloak,payload=["UPDATE_PASSWORD"], client_id ='security-admin-console',lifespan = life_span, redirect_uri = redirect_url)
         return 'Email Sent'               
       except Exception as error:
         return repr(error)
       $forgotpasswordwithredirecturifn$ LANGUAGE plpython3u ;       

     
       DROP FUNCTION IF EXISTS ${kaQR("create_user")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("create_user")}(email text, username text, value_password text,  firstname character varying, lastname character varying,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS json      
     AS $createuserFn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
       keycloak_admin.realm_name = user_realm_name                                
       new_user = keycloak_admin.create_user({"email":email,
                             "username": username,
                             "enabled": True,
                             "firstName":firstname,
                             "lastName": lastname,
                             "credentials": [{"value": value_password,"type":  "password",}]})
       return json.dumps(new_user);                 
     except Exception as error:
       return json.dumps(repr(error))
     $createuserFn$ LANGUAGE plpython3u     ;


     DROP FUNCTION IF EXISTS ${kaQR("create_user_without_password")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("create_user_without_password")}(email text, username text, firstname character varying, lastname character varying,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS json      
     AS $createuserFn$
     import json
     from keycloak import KeycloakOpenID
     from keycloak import KeycloakAdmin
     try: 
       
       keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
       keycloak_admin.realm_name = user_realm_name                                
       new_user = keycloak_admin.create_user({"email":email,
                             "username": username,
                             "enabled": True,
                             "firstName":firstname,
                             "lastName": lastname})
       return json.dumps(new_user);                 
     except Exception as error:
       return json.dumps(repr(error))
     $createuserFn$ LANGUAGE plpython3u     ;

     DROP FUNCTION IF EXISTS ${kaQR("get_token_realm")} CASCADE;
     CREATE OR REPLACE FUNCTION ${kaQR("get_token_realm")}(username text, passwords text, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, client_name text, clientid text)
     RETURNS json
     LANGUAGE plpython3u
    AS $function$
      import json
      from keycloak import KeycloakOpenID
      from keycloak import KeycloakAdmin
      try:         
        keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                         username=admin_username,
                                         password=admin_password,
                                         realm_name=master_realm,                                     
                                         verify=True)    
        keycloak_admin.realm_name = user_realm_name
        response = keycloak_admin.get_client_secrets(clientid)
        client_secret_key = response['value']
        keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                          client_id=client_name,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key)        
        token = keycloak_openid.token(username, passwords, scope="openid")       
        return json.dumps(token)                 
      except Exception as error:
        return json.dumps(json.loads(error.args[0]))
      $function$
    ;
    DROP FUNCTION IF EXISTS ${kaQR("refresh_token_realm")} CASCADE;
    CREATE OR REPLACE FUNCTION ${kaQR("refresh_token_realm")}(refresh_token character varying, api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text, client_name text, clientid text)
      RETURNS json
      AS $refreshtokenrealm$
        import json
        from keycloak import KeycloakOpenID
        from keycloak import KeycloakAdmin
        try: 
          
          keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                          username=admin_username,
                                          password=admin_password,
                                          realm_name=master_realm,                                     
                                          verify=True)    
          keycloak_admin.realm_name = user_realm_name
          response =keycloak_admin.get_client_secrets(clientid)
          client_secret_key = response['value']
          keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                            client_id=client_name,
                            realm_name=user_realm_name,
                            client_secret_key=client_secret_key)
          token = keycloak_openid.refresh_token(refresh_token)	
          return json.dumps(token);                 
        except Exception as error:
          return json.dumps(json.loads(error.args[0]))
        $refreshtokenrealm$ LANGUAGE plpython3u;

    CREATE OR REPLACE FUNCTION ${kaQR("disable_realm")}(api_base_url text, admin_username text, admin_password text, user_realm_name text, master_realm text)
    RETURNS text    
    AS $disablerealm$
    from keycloak import KeycloakOpenID
    from keycloak import KeycloakAdmin
    try:        
     keycloak_admin = KeycloakAdmin(server_url=api_base_url,
                                       username=admin_username,
                                       password=admin_password,
                                       realm_name=master_realm,
                                       verify=True)
     keycloak_admin.update_realm(realm_name = user_realm_name ,payload={"enabled" : False})  
     return  "success";
    except Exception as error:
     return repr(error)
    $disablerealm$ LANGUAGE plpython3u;


    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${lcf.unitTest(state).qName}();        
        
        DROP TABLE IF EXISTS ${cQR("keycloak_provenance")} CASCADE;
    END;
    $$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE FUNCTION ${lcf.unitTest(state).qName}() RETURNS SETOF TEXT AS $$
    BEGIN 
        RETURN NEXT has_table('${schemas.confidential.name}', 'keycloak_provenance');
    END;
    $$ LANGUAGE plpgsql;`;
}
