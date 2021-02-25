supplyRecipeJustFile := "../recipe-suppliers.justfile"
emitRecipeCmd := "../emit-recipe-content.pl"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippets to create common auth functions, roles and grant permissions
psql-construct-auth-manager:
    @cat auth-manager.sql

# Generate psql SQL snippets to drop auth functions
psql-destroy-auth-functions:
    #!/usr/bin/env {{emitRecipeCmd}}
    DROP FUNCTION IF EXISTS :schema_assurance.test_auth_manager();
    DROP FUNCTION IF EXISTS authenticate_postgraphile(text,text);
    DROP FUNCTION IF EXISTS create_user_with_role(text,text);

    -- TODO : DROP TYPE IF EXISTS jwt_token_postgraphile CASCADE;

# Generate the auth manager SQL snippets from child recipes
psql-construct: psql-construct-auth-manager
  
# Generate psql SQL snippets to revoke permissions to user
