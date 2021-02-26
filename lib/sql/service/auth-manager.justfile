supplyRecipeJustFile := "../recipe-suppliers.justfile"
emitRecipeCmd := "../emit-recipe-content.pl"

_pg-dcp-recipe +ARGS:
    @just -f {{supplyRecipeJustFile}} {{ARGS}}

# Generate psql SQL snippets to create common auth functions, roles and grant permissions
psql-construct-auth-manager:
    @cat auth-manager.sql
    @cat postgraphile.sql

# Generate psql SQL snippets to drop auth functions
psql-destroy-auth-manager:
    #!/usr/bin/env {{emitRecipeCmd}}
    DROP FUNCTION IF EXISTS :schema_assurance.test_auth_manager();
    DROP FUNCTION IF EXISTS :schema_assurance.test_auth_postgraphile();
    DROP FUNCTION IF EXISTS authenticate_postgraphile(text,text);
    DROP FUNCTION IF EXISTS create_user_with_role(text,text);
    DROP TYPE IF EXISTS jwt_token_postgraphile;

# Generate the auth manager SQL snippets from child recipes
psql-construct: psql-construct-auth-manager
  
# Generate the auth manager SQL snippets from child recipes
psql-destroy: psql-destroy-auth-manager
