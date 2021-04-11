# PgDCP SQL Assembler (`SQLa`)

Since the PostgreSQL Data Computing Platform (PgDCP) leverages SQL for its
functionality, assembling and loading SQL in a deterministically reproducible
manner is crucial. The PgDCP _SQL Assembler_ (`SQLa`) is a Deno TypeScript
module which uses the power of JavaScript
[Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
to create SQL components as building blocks. Instead of inventing yet another
template language, `SQLa` uses a set of naming conventions plus the full power
of JavaScript (and TypeScript) Template strings to prepare the final SQL that
will be loaded into the database.

## Terms

- **Schema**. A typical PostgreSQL schema.
- **Affinity Group** (**AG**). A group of SQL objects that are related by
  subject; each schema may have one or more subject-based affinity groups.
  Affinity groups allow `SQLa` to combine multiple subjects into a single schema
  during assembly.
  - A schema is also considered, conceptually, an affinity group. This is
    helpful since any affinity group may just be deployed by itself into a
    single schema or combined with other AGs into a single schema. When
    referencing an AG _or_ schema we use **AGorS** below.
- **Context**. Execution environments such as `sandbox`, `devl`, `test`, and
  `production` are _examples_ of contexts. The nature of Context is
  usage-dependent and should be documented with assets/objects. For example, a
  context can be extended with dot-notation (e.g. `production.[account]` meaning
  this context is for _production_ for a specific _account_).
  - `sandbox` and `devl` are considered _experimental_ contexts and should only
    contain synthetic or generated data.
  - `test` may also be considered _experimental_, especially if all data is
    synthetic. If `test` databases include copies of production data that are
    not anonymized they are considered `confidential experimental` data.

## Principles & Practices

In general, we favor _stored procedures_ (SPs) instead of _stored functions_
(SFs) for object construction and destruction activities because SPs can
participate in and be, themselves, transactions. We want to encapsulate all our
scripts in SPs and execute them in the database. This way, every script is, at
least, documented in the database if not fully reusable and idempotent.

- Create _stored procedures_ (SPs) for all object construction and destruction
  activities.
- Each SP must be idempotent, versioned, and event storable whenever possible.
  Of course, object storage construction and destruction SPs are not idemponent
  (unless wrapped in appropriate IF clauses,
  [but that might be an anti-pattern](https://thedailywtf.com/articles/Database-Changes-Done-Right)).
- Idempotency of _object storage_ construction should be guaranteed by
  introspecting the structure whenever possible (rather than just version
  numbers).
  - Use PgTAP for introspection whenever possible, use PG catalog directly when
    PgTAP does not provide an introspection feature,
- Idempotency of all other types of object construction (e.g. types, views,
  routines, etc.) should be guaranteed by taking versions as input and passing
  versions in output.
- For transactions where _history_ (change data capture) at the row level is
  important, include a `activity JSONB` column which will contain all changes as
  JSON. The JSON activity on a per-table basis can be included in each table as
  a column in the table or with an adjacent or related 1:1 normalized table in a
  separate tablespace / partition / schema. For example, if table is X then
  another table called X_activity can be created with `activity JSONB` column in
  the related adjacent table.
  [Auto-generated triggers](https://github.com/solidsnack/macaroon/blob/master/audit.sql)
  or [other techniques](https://mydbanotebook.org/post/auditing/) could be used
  to keep the change data capture history automatically.

For a good understanding of anti-patterns check out
[Database Changes Done Right](https://thedailywtf.com/articles/Database-Changes-Done-Right).

## Stored Procedures

By convention, all SQL is created within the following _types_ of stored
procedures within _affinity groups_ (or _schemas_):

- `[AGorS]_registration`. Responsible for the providing profile, dossier, or
  similar configuration information for a schema or affinity group.
- `[AGorS]_construct_storage`. Responsible for the creation of all _storage
  assets_ related. All `create table` and other DDL which defines data storage
  would be contained in `*_construct_storage` procedures.
  - Each function is responsible to check to see which version of objects are
    created and only update those necessary
  - Each function is responsible for updating its version number
- `[AGorS]_construct_idempotent`. Responsible for the _creation_ of all
  _non-storage assets_, which are typically idempotent. All `create type`,
  `create view`, `create function`, and other assets which are idempotent in
  nature should be constructed in this stored procedure.
  - Pay special attention to idempotent assets such as stored procedures or
    functions that have dependencies.
  - Each function is responsible for logging info, warn, error, and exception
    logs into the event/activity storage system.
- `[AGorS]_destroy_storage`. Responsible for the destruction of all storage
  assets created by `[AGorS]_construct_storage`.
- `[AGorS]_destroy_idempotent`. Responsible for the destruction of all
  non-storage, idempotent, assets created by `[AGorS]_construct_idempotent`.
- `[AGorS]_deploy_provenance_http_request`. Responsible for providing an HTTP
  Request filled out to retrieve the latest code that will upgrade this affinity
  group or schema.
- `[AGorS]_upgrade`. Uses `[AGorS]_deploy_provenance_http_request` to obtain the
  latest code and reload the code into the database, effectively "upgrading" the
  affinity group or schema.
- `[AGorS]_hook_*`. TODO: Responsible for responding to external requests from
  CI/CD or other webhook consumers. The job of the hook might be something as
  simple as refreshing a materialized view or something more complicated such as
  rebuilding all schema objects.
- `[AGorS]_test_*`. pgTAP unit tests for objects related to a schema or AG.
- `[AGorS]_lint_*`. `plpgsql_check` lint results for objects related to a schema
  or AG.
- `[AGorS]_health_*`. TODO: Runtime health checks that applications and services
  can run to see if they have a connection and proper permissions (e.g. `ping`
  style).
- `[AGorS]_doctor_*`. Runtime dependency checks that applications and services
  can run to see if all required dependencies are installed (e.g. extensions).
- `[AGorS]_observability_metrics_*`. Responsible for generating OpenMetrics for
  the affinity group, when requested. Typically this will be a view which, when
  called by PostgREST or Postgraphile, will generate OpenMetrics format text
  output that can be scraped by Prometheus.
- `[AGorS]_populate_secrets`. Responsbile for populating confidential data
  related to the objects.
- `[AGorS]_populate_seed_data`. Responsbile for populating seed data used across
  all contexts.
  - Each function is responsible for logging info, warn, error, and exception
    logs into the event/activity storage system.
- `[AGorS]_populate_[context]_data`. Responsbile for populating context-specific
  data that is not transactional in nature.
  - `[AGorS]_populate_experimental_data`. Responsbile for populating
    experimental (test/devl/sandbox) data which is not used for production
    database.

`[AGorS]_` can be _either_ an _affinity group_ name _or_ a _schema_ name,
depending on the developer's declarations.

## Versioning

PgDCP encourages fine-granined [Semantic Versioning](https://semver.org/) by
providing version-management infrastructure using
[semver](https://pgxn.org/dist/semver/doc/semver.html) extension's custom
`semver` data type. All versions of every database object/asset starts at 1.0.0
and incremented based on:

- Major. The major version should be incremented if any structural changes occur
  that might lose data (e.g. dropping a column).
- Minor. The minor version should be incremented if any structural changes occur
  but no data would be lost (e.g. adding a column, adding constraints).
- Patch. The patch version should be incremented if any changes occur that are
  non-structural (e.g. adding comments).

# TODOs

Infrastructure TODOs:

- Add `context` parameter to each lifecycle function like `construct_*`,
  `destroy_*`, etc. so that the procedure can make a decision about how to
  proceed in different runtime environments/contexts like sandbox, devl,
  production, etc. Instead of making decisions about context at SQL generation
  time, this would allow us to make decisions at runtime.
  - We should create a `dcp_context` schema which would contain a table called
    `execution_context` and contain global information about the database's
    execution context.
  - The `context` parameter should default to `dcp_context.execution_context`
    row that would "know" which database was currently running (e.g. sandbox,
    devl, production, etc.)
  - Create convention of custom data types called `schema_registration`,
    `schema_configuration` and `schema_nature` in each schema and a single
    function `registry` which will return a constant that groups the
    config/nature and combine any other meta data, settings, etc. for a given
    schema (make sure to use the PG catalog to stay
    [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)). Instead of
    putting nature and dossier information into the name of the schema, we can
    have well-typed definitions.
    - `nature` would be used for settings that would not change often
      - Add stateless, statful, enhance, unrecoverable, FDW, etc. would probably
        be good for `nature` meta data
    - `configuration` would be used for settings that could reasonably change
      often
      - Semver to version the schema might be good for `configuration` meta data
- Review
  [Sequential UUID Generators](https://www.2ndquadrant.com/en/blog/sequential-uuid-generators/)
  to create less expensive keys for Data Vault objects.
- Create `SQLa` templates to provide per-schema introspection for our naming
  conventions using
  [PgTAP](https://raw.githubusercontent.com/theory/pgtap/8f8bb50fc8871dbbcf8dadd240069ae721678a7b/sql/pgtap--0.95.0--0.96.0.sql.in)
  guidance. For example, we should be able to locate our lifecycle stored
  routines by searching the PG catalog.
- Create `SQLa` templates to implement guidance from
  [Simply auditing your database changes](https://mydbanotebook.org/post/auditing/).
- Move FDWs from simple schema names to real objects provided in `state`
  Options. Add `PostgreSqlForeignDataWrapper` as new interface to track and
  verify FDWs. `PostgreSqlForeignDataWrapper` is probably just a subclass of
  Schema.
- Add `plpgsql_check` into all PgTAP unit tests; consider adding a new AG
  lifecycle function call `lint_*` which would be called by
  `select * from runlint()`.
- Add ability to automatically segregate views that consumers can use from
  tables ("stores") that should be considered private and not used by
  consumers/developers.
  - Make the views all updatable in accessible schemas while tables' schemas
    would be inaccessible and might even have
    [create rule](https://www.postgresql.org/docs/13/sql-createrule.html) based
    notices.
- Create auto-generated SQL to enforce immutability of tables -- e.g. the
  version tables, events tables, should allow insert but not update/delete. See
  [this conversation](https://www.tek-tips.com/viewthread.cfm?qid=1116256).
- Create auto-generated SQL to validate data before it goes into tables -- we
  want to allow UIs to call validation functions/views that return error
  messages that would be identical to what would happen if constraints are
  violated, before those constraints are actually violoated when data is
  inserted/updated. This should probably use `PLv8` so that the same code that
  runs in the UI can be run on the server, inside the database.
- Go through all `[AGorS]_construct_storage` and `[AGorS]_construct_idempotent`
  procedures in all `*.sql.ts` templates to ensure storage is properly separated
  from idempotent functionality.
  - Add, to all `*_construct_*` functions, a call to record its creation version
    and event log.
- Go through all `[AGorS]_destroy_storage` and `[AGorS]_destroy_idempotent`
  procedures in all `*.sql.ts` templates to ensure storage is properly separated
  from idempotent functionality.
  - Add, to all *_destroy() functions the requirement that it be a specific user
    that is calling the destruction (e.g. "dcp_destroyer") and that user is
    highly restricted.
- Add health checks standard functions that applications and service consumers
  can call to verify that runtime execution will not fail.
  - Example: _doctor_ style functionality that will:
    - Test that all extensions required are installed and will not throw runtime
      exceptions
    - Test that caller has permissions to all dependencies such as schemas,
      objects, and will not throw runtime exceptions
- Add `[AGorS]_hook_*` for responding to external requests from CI/CD or other
  webhook consumers. The job of the hook might be something as simple as
  refreshing a materialized view or something more complicated such as
  rebuilding all schema objects.

* See
  [Generating realistic user timestamps in
  SQL](https://www.narrator.ai/blog/generating-random-timestamps-in-sql/) for
  how to create synthetic timestamps for test data.

Data Vault TODOs:

- Add `active`, `version`, `effective_at` and `expired_at` columns to
  `SatelliteTable` for storing history.
  - Add rule to check that every satellite has at least one record so that outer
    joins are not necessary?
- See if it makes sense to implement custom
  [point in time (PIT) tables](https://danlinstedt.com/allposts/datavaultcat/pit-bridge-value/).
- See if it makes sense to implement custom
  [bridge tables](https://blog.scalefree.com/2019/03/13/bridge-tables-101/).
- Add Lifecycle functions for loading (should we use `populateSeedData`, etc.?).
- Add Lifecycle functions pg_cron-based auto-update capability (which and
  automatically retire old versions and refresh views).
- Add _sensitivity_ ltree[] to allow confidentiality to be specified in
  provenance as well as prime; base on _sensitivity_ we may want to store
  encrypted text/JSON/XML.
- Add OpenTelemetry Trace Hub to group Spans with Links
- Add OpenTelemetry Log Hub that can integrate Exceptions, Traces, and Spans
- Add OpenMetrics / OpenTelemetry Metric Hub that can store metrics which can be
  exposed as Prometheus endpoints via PostgREST.

## Activity Log

### April 10, 2021

- Implement Active Context to indicate whether host is prod/devl/test/sandbox/etc. The dcp_context schema now has a table called 'context' which contains a singleton row table which configures the active database as a prod/test/sandbox/etc. database.
- Remove legacy Just-based SQL assembler in favor of Deno TypeScript-based
  modules.
- Refactor all TypeScript-based `SQLa` into `typical` and `data-vault` for
  proper separation of concerns.

### March 29, 2021

- Introduce new `asset.sql.ts` which is a type-safe library for managing remote
  assets such as GitLab project repo files.

### March 27, 2021

- Migrated all extensions into new `dcp_extensions` schema instead of `public`.
- Added type-safe `gitlab_provenance` instead of `etc_` and `etc_secret_*`
  tables.
- Added `lifecycle.sql.ts` template with `execution_context` domain and
  `exec_context_production()` and other `exec_context_*()` functions as
  "constants".
- Added standard `metrics` function to AffinityGroup lifecycle functions.

### March 24, 2021

- Refactored `state`.`searchPath` from a `string[]` to `PostgreSqlSchema[]` to
  increase type-safety.
- Created new `state`.`setSearchPathSql()` that should be used whenever active
  search path SQL is required.

### March 23, 2021

- Moved extension requirements from simple templates to `state` Options so that
  we can auto-generate health checks.
- Use [semver](https://pgxn.org/dist/semver/doc/semver.html) data type for
  `version.sql.ts` `version` column.
- Added `lint` standard function to `schema.lcFunctions` to prepare
  infrastructure for `plpgsql_check` calls.

### March 22, 2021

- [SNS] Separated `[AGorS]_construct` into individual
  `[AGorS]_construct_storage` and `[AGorS]_construct_idempotent`, which should
  be callable indepdently.
- [SNS] Separated `[AGorS]_destroy` into individual `[AGorS]_destroy_storage`
  and `[AGorS]_destroy_idempotent`, which should be callable indepdently.
- Added `asset_version` table which has context, path, and version. This allows
  us to check whether an _object_ (or _asset_) is at a particular version.
- When emitting provenance, allowed to make URLs relative so that files don't
  show as changed because they're generated on different hosts
- Moved `[AGorS]_populate_experimental_data` into `dcp_experimental` schema by
  default.
- Renamed `auth` AG to `shield`.
