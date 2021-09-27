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
  const [sQR, cQR, exQR, ctxQR, lQR] = state.observableQR(
    state.schema,
    schemas.confidential,
    schemas.extensions,
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

    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}() AS $$
    BEGIN
    CREATE OR REPLACE FUNCTION ${lQR("get_token")}(username text, passwords text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
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
        token = keycloak_openid.token(username, passwords)        
        return json.dumps(token)                 
      except Exception as error:
        return json.dumps(repr(error))
      $gettokenfn$ LANGUAGE plpython3u
      ;

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
       return response['value'];                 
     except Exception as error:
        return json.dumps(repr(error))
     $getclientsecretfn$ LANGUAGE plpython3u
   ; 

    

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
        return json.dumps(repr(error))
      $userinfofn$ LANGUAGE plpython3u
      ;

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
        return json.dumps(repr(error))
      $refreshtokenfn$ LANGUAGE plpython3u
      ;


      CREATE OR REPLACE FUNCTION ${lQR("logout")}(refresh_token varchar,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text  )
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
                          client_id=client_id,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key)
        keycloak_openid.logout(refresh_token)	
        return "logged out";                 
      except Exception as error:
        return repr(error)
      $logoutfn$ LANGUAGE plpython3u
      ;
      
      CREATE OR REPLACE FUNCTION ${lQR("create_user")}(email text, username text, value_password text, is_enabled boolean, firstname character varying, lastname character varying,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text  )
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
        return "group created"; 
      except Exception as error:
        return repr(error)
      $creategroupfn$ LANGUAGE plpython3u;

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

      CREATE OR REPLACE FUNCTION ${lQR("get_user_id")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json
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
      return json.dumps(user_id_keycloak);
      $getuseridfn$ LANGUAGE plpython3u;    


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

      CREATE OR REPLACE FUNCTION ${lQR("create_subgroup")}(parent_group_name text, group_name text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text )
      RETURNS json      
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
        allgroups = keycloak_admin.get_groups()
        for s in range(len(allgroups)):
          if allgroups[s]["name"] == parent_group_name:
            grp = allgroups[s]["id"]
        group = keycloak_admin.create_group(parent=  grp, payload={"name": group_name}, skip_exists=False)
        return json.dumps(group)
      except Exception as error:
        return repr(error)
      $createsubgroupfn$ LANGUAGE plpython3u
      ;

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

      CREATE OR REPLACE FUNCTION  ${lQR("introspect")}(access_token text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text ,client_name text)
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
          client_id = keycloak_admin.get_client_id(client_name)
          response =keycloak_admin.get_client_secrets(client_id)        
          client_secret_key = response['value']
          keycloak_openid = KeycloakOpenID(server_url=api_base_url,
                          client_id=client_id,
                          realm_name=user_realm_name,
                          client_secret_key=client_secret_key) 
          token_info = keycloak_openid.introspect(access_token)
          return json.dumps(token_info)                 
        except Exception as error:
          return json.dumps(repr(error))
        $introspectfn$
      ;
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
       token = keycloak_openid.token(username, passwords)        
       return json.dumps(token)                 
     except Exception as error:
       return json.dumps(repr(error))
     $gettokenfn$ LANGUAGE plpython3u
     ;

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
       return json.dumps(repr(error))
     $refreshtokenfn$ LANGUAGE plpython3u
     ;

     

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

   CREATE OR REPLACE FUNCTION ${kaQR("get_tokenotp")}(username text, passwords text,totp_code text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text,client_name text)
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
     return json.dumps(repr(error))
   $gettokenfn$ LANGUAGE plpython3u
   ;

   
     CREATE OR REPLACE FUNCTION ${kaQR("forgot_password")}(username text,api_base_url text,admin_username text , admin_password text,user_realm_name text,master_realm text)
     RETURNS json      
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
         return json.dumps(response)                 
       except Exception as error:
         return json.dumps(repr(error))
       $forgotpasswordfn$ LANGUAGE plpython3u ;

     
     
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
