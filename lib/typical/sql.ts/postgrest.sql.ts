import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("postgrest");

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
        extensions: [schemas.extensions.pgCryptoExtn],
      },
  );
  return SQLa.SQL(ctx, state)`
    -- We want all our object creations to be idempotent whenever possible
    CREATE OR REPLACE FUNCTION notify_ddl_postgrest()
      RETURNS event_trigger
    LANGUAGE plpgsql
      AS $$
    BEGIN
      NOTIFY ddl_command_end;
    END;
    $$;


    CREATE EVENT TRIGGER ddl_postgrest ON ddl_command_end
        EXECUTE PROCEDURE notify_ddl_postgrest();


`;
}
