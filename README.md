# PostgreSQL Data Computing Platform (PgDCP)

PgDCP is Netspective's approach for using PostgreSQL to host tables, views, plus
polyglot stored routines and surface them as GraphQL and REST using
Postgraphile, Hasura, and PostgREST (or
[pREST](https://github.com/prest/prest)). Using PostgreSQL whenever possible is
called our _Zero Middleware_ automated backend as a service (AutoBaaS) strategy.
AutoBaaS helps us eliminate signficant amounts of GraphQL and REST boilerplate
code plus reduces the number of microservices we need to deploy and manage.

_Zero Middleware_ is first and foremost a _technology strategy_ but also comes
with a framework of code generators and reusable components to reducing
data-centric code surfaces to just PostgreSQL with auto-generated,
database-first _secure_ GraphQL and REST endpoints. For use cases when
higher-performance or more secure interfaces are necessary, direct access to
tables, views, and stored routines using PostgreSQL wire protocol is encouraged.

We use `psql` and pure-Postgres migrations as Database as Code (“DaC”) for DDL,
DQL, DML, etc. when possible. Instead of relying on 3rd party dependencies for
schema migrations, we use PostgreSQL-first stored routines themselves along with
`psql` to manage idempotent migrations.

The overall objective for PgDCP is to reduce the number of tools that a
developer needs to know down to just PostgreSQL and `psql` along with SQL and
PL/* hosted languages for all services.

## Fear the Movement of Data! (FMD!)

The more we move data from one system to another (e.g. traditional ETL or it's
cooler cousin ELTs), the more likely we are to run into scalability problems.
Almost all modern databases are pretty good at querying and are able to do
optimizations to improve querying either using vertical scaling or, in advanced
cases, using horizontal scaling. However, no databases are good at moving data
at scale. The reason we should fear the movement of data is that moving data
from one system into another or vice-versa is almost always the most
time-consuming part of data computing stacks.

Whenever dealing with data at scale, bring "_compute_ to data" rather that
"_moving data_ to the compute clusters". PgDCP as an approach tries to use FDWs
to leave data in their original locations when possible and only move the
specific data when it cannot be processed in its original location. If it cannot
eliminate data movement from source systems, PgDCP tries to reduce data movement
to only a single data move into the PgDCP environment and then uses schemas,
views, materialized views, etc. to transform data _virtually_ instead of
_physically_.

Even when applying Unified Star Schemas (USS), Dimensional Modeling, Dault Vault
2.0, or other techniques we try to use late-binding rather than early-binding
when possible.

## Polyglot but SQL-first

Our first choice of languages for writing data-centric micro services should be:

- Pure SQL views, materialized views, and stored routines using
  [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).
- pgSQL views and materialized views and PL/pgSQL stored functions and stored
  procedures when pure SQL is not possible, using
  [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

In case SQL or PL/pgSQL is not appropriate:

- PL/Rust, PL/Java, PL/Go, [PL/Deno](https://github.com/supabase/postgres-deno)
  or other type-safe PostgreSQL-hosted language should be prioritized.
- If type-safety is not possible or 3rd party libraries access is more important
  than type-safety then PL/Python, PL/Perl, and other languages should be
  considered.
  - When using PL/Python or other language with package managers, consider using
    guidance such as
    [programmatic access to PIP modules](http://jelly.codes/articles/python-pip-module/)
    so that PostgreSQL server admins are not required for administering module
    dependencies
- The choice of language should depend on how easy the functionality can be
  expressed using
  [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

## Information Assurance and Security _in the Database_

PgDCP requires _database-first_ security, which means PostgreSQL schemas, users,
roles, permissions, and row-level security (RLS) should drive all data security
requirements. Role-based access control (RBAC) and attribute based access
control (ABAC) should be implemented in PostgreSQL stored routines. If
necessary, [ldap2pg](https://github.com/dalibo/ldap2pg) can be used to
synchronize roles with LDAP.

Because all our API functionality (except for serving the endpoints) will also
be _in the database_ we want to ensure that we secure views, stored procedures,
and stored functions as if they were the API endpoints.
[OWASP API Security Project](https://owasp.org/www-project-api-security/)
provides some great advice.

### Securing Access _to the Database_

If all access management is _in the database_, then securing access _to the
database_ is paramount. To that end, see:

- [Securing Databases with Dynamic Credentials and HashiCorp
  Vault](https://github.com/sql2/PostgreSQL_with_Dynamic_Credentials)
- [Using Vault to manage dynamic credentials of a
  Postgres](https://github.com/florx/secrets-are-hard-demo)

## Deliberate and Disciplined Change Management _in the Database_

In PgDCP PostgreSQL is not treated as a "bit bucket" where you just store data
for an application. It's the center and most important part of our services'
universe and requires a deliberate, disciplined, database-first change
management approach. While there are many database migrations tools like
LiquiBase, Flyway, and Sqitch, they all assume that the problem should be solved
in a database-independent manner outside of PostgreSQL. Since the PgDCP approach
is to double-down on PostgreSQL and not worry about database portability, we
want to perform PosgreSQL-first database change management.

First review Martin Fowler's
[Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)
article and then see tools like:

- [postgresql\-dbpatch](https://github.com/linz/postgresql-dbpatch), which
  support conducting database changes and deploying them in a robust and
  automated way through the database instead of external tools
- [Metagration](https://github.com/michelp/metagration), a PostgreSQL migration
  tool written in PostgreSQL
- [Konfigraf](https://github.com/PaulHatch/konfigraf), a Postgres extension that
  allows you to store and manipulate data in Git repositories stored in tables
  within the database. This is designed to be used for storage of configuration
  data for applications and services.

## Integrated Observability for Health, Metrics and Traceability _in the Database_

Observability of the database is important for forensics and quality assurance.
Try to use
[simplified auditing based on SQL logging and FDWs to import
logs](https://mydbanotebook.org/post/auditing/) instead of writing brittle
custom triggers on each table/object. Separate observability into DDL changes,
which can be alerted upon, as well as DML change logs which can be used for
forensics. Wrap the observability of logs into a metrics table that can be
scraped by Prometheus and used for alerting (e.g. whenever DDL changes occur,
send alerts to anyone who needs to be informed).

Especially important is to integrate OpenTelemetry trace IDs into each DDL and
DML statement so that end to end traceability becomes native to the database.
Being able to track context and propogation of SQL through service layers will
be critical to maintain high quality and reliability.

See
[semantic conventions for database client
calls](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/database.md)
for how to provide traceability for database client calls and integrate
[W3C's Trace Context](https://www.w3.org/TR/trace-context/).

## Client Application-friendly Type-safety _in the Database_

Modern applications demand type-safety (which is why PgDCP recommends TypeScript
or Rust for applications). Since applications should be type-safe, we want our
data models and database objects to also be type-safe. To enhance type-safety,
create custom [domains](https://www.postgresql.org/docs/current/domains.html),
custom enumerations or lookup tables based on inheritance,
[business types](https://www.postgresql.org/docs/current/sql-createtype.html),
and
[inheritable transaction tables](https://www.postgresql.org/docs/current/ddl-inherit.html)
("table types"). Once you're using table inheritance you can use
[table inheritance wrapper functions](https://github.com/trimark-jp/tm-postgres-basics).

## GraphQL-first but REST-capable _in the Database_

All micro services code in PostgreSQL tables, views, functions and stored
procedures will be surfaced through Postgraphile GraphQL first but our AutoBaaS
requirements are that all services should be exposed through safe and secure
REST interfaces via PostgREST (or [pREST](https://github.com/prest/prest)) as a
fallback for non-GraphQL clients. We favor Postgraphile's GraphQL API because it
generates code which honors PostgreSQL security, roles, and unique features more
faithfully than other utilities such as Hasura.

## Friendlier and Safer Experimentation

Promote the use of
[Database Lab Engine (DLE)](https://gitlab.com/postgres-ai/database-lab) to
"provision independent non-production environments with multi-terabyte
PostgreSQL databases in a few seconds." Every developer should be able to have
their own easy to create and teardown development instances for experimentation
purposes and to make sure scripts are idempotent and repeatable. If database
cannot be easily torn down and recreated in development and quality assurance
environments, scripting is harder.

Part of the DLE is "Joe", which should be used by engineering and QA teams:

> “Joe Bot”, a virtual DBA for SQL optimization, is a revolutionary new way to
> troubleshoot and optimize PostgreSQL query performance. Instead of running
> EXPLAIN or EXPLAIN (ANALYZE, BUFFERS) directly in production, users send
> queries for troubleshooting to Joe Bot. Joe Bot uses the Database Lab Engine
> (DLE) to:

> - Generate a fresh thin clone
> - Execute the query on the clone
> - Return the resulting execution plan to the user
> - The returned plan is identical to production in terms of structure and data
  > volumes – this is achieved thanks to two factors: thin clones have the same
  > data and statistics as production (at a specified point in time), and the
  > PostgreSQL planner configuration on clones matches the production
  > configuration.

## Assurance as Code _in the Database_

All code in PostgreSQL should be tested, or _assured_, with pgTAP code. All
_Assurance Engineering Cases_ (AECs) should be written code-first, not
human-first (what we call _Assurance as Code_).

### Chaos in _in the Database_

Because our responses to bugs in the database which might lead to database
crashes is only as good as the number of times we see such crashes, we should
use tools like [pg_crash](https://github.com/cybertec-postgresql/pg_crash), a
"Chaos Monkey" Extension for PostgreSQL databases. Per their repo "pg_crash is
an extension to PostgreSQL, which allows you to periodically or randomly crash
your database infrastructure by sending kill (or other) signals to your DB
processes and make them fail. It is ideal for HA and failover testing."

## Microsoft Excel-first UX but client-independent

Microsoft Excel should be the first UI that all data access should be designed
for when accessing outside of developer-centric PgDCP use cases. If Excel can
properly show your data, in a safe, secure, and performant way, then every other
client can also do so. Excel-first UX should target "live ODBC" use cases where
the database is directly accessed using PostgreSQL binary protocol.

## Primary Keys vs. Surrogate Keys for external consumption

Good security practice for modern apps that will allow record IDs to be shared
externally is to either have UUID or shortkey (see below) non-serial primary
keys. If you use a `serial` type primary key, never send the PK out for external
consumption - always use surrogate keys via
[uuid\-ossp](https://www.postgresql.org/docs/13/uuid-ossp.html) or similar. If
you use a serial PK and share the ID externally then it will be possible for
external users to "guess" IDs since the PKs would adjacent numerically.

## Real-time Information via PostgreSQL Notify

[Postgres Notify for Real Time
Dashboards](https://blog.arctype.com/postgres-notify-for-real-time-dashboards/)
provides a great description of how to "push" updates to clients.

## PgDCP Engineering Resources

Platform and site reliability engineers should review:

- [psql command line tutorial and cheat
  sheet](https://github.com/tomcam/postgres)
- [Postgres features showcase \(commented SQL
  samples\)](https://github.com/cybertec-postgresql/postgres-showcase)
- [postgres_dba](https://github.com/NikolayS/postgres_dba) set of useful tools
  for Postgres DBAs and all engineers
- [Set of Practices](https://kukuruku.co/post/postgresql-set-of-practices/) for
  common PG engineering suggestions
- [pgcenter](https://github.com/lesovsky/pgcenter) CLI tool for observing and
  troubleshooting Postgres
- [PGXN client](https://github.com/pgxn/pgxnclient) CLI tool to interact with
  the PostgreSQL Extension Network
- [Useful views and functions for postgreSQL
  DBA's](https://github.com/sahapasci/dba.postgresql)
- [Postgres extension to introspect postgres log
  files](https://github.com/sroeschus/loginfo) from within the database
- [Postgres clone schema utility](https://github.com/denishpatel/pg-clone-schema)
  without need of going outside of database. Makes developers life easy by
  running single function to clone schema with all objects. It is very handy on
  Postgres RDS.
- [An unassuming proposal for PLSQL Continuous Integration using revision
  control, Jenkins and Maven\.](https://github.com/pauldzy/Tentative_PLpgSQL_CI)
- [Securing Your PostgreSQL Database](https://goteleport.com/blog/securing-postgres-postgresql/)

Engineers writing stored routines (functions, SPs) should review:

- [Boost your User-Defined Functions in
  PostgreSQL](https://www.ongres.com/blog/boost-your-user-defined-functions-in-postgresql/)
  describes some useful techniques for improving UDFs.
- [Building a recommendation engine inside Postgres with Python and
  Pandas](https://blog.crunchydata.com/blog/recommendation_engine_in_postgres_with_pandas_and_python)
- [postgresql\-plpython\-webservice](https://github.com/bryantbhowell/postgresql-plpython-webservice)
  shows how to caching web service requests via PL/Python
- [Metagration](https://github.com/michelp/metagration), a PostgreSQL migration
  tool written in PostgreSQL
- [BedquiltDB](https://bedquiltdb.github.io/) is a JSON document-store built on
  PostgreSQL using PL/Python

Engineers writing applications should consider these PostgreSQL-native
libraries:

- [makeExtendSchemaPlugin](https://www.graphile.org/postgraphile/make-extend-schema-plugin/)
  merges additional GraphQL types and resolvers into a Postgraphile PostgreSQL
  schema using a similar syntax to
  [graphql-tools](https://www.graphql-tools.com/docs/generate-schema).
- [uuid\-ossp](https://www.postgresql.org/docs/13/uuid-ossp.html) for UUIDs as
  primary keys
- [ltree](https://www.postgresql.org/docs/13/ltree.html) for representing labels
  of data stored in a hierarchical tree\-like structure
- [pg_trgm](https://www.postgresql.org/docs/11/pgtrgm.html) module provides
  functions and operators for determining the similarity of alphanumeric text
  based on trigram matching
- [simplified auditing based on SQL logging and FDWs to import
  logs](https://mydbanotebook.org/post/auditing/) instead of writing triggers
  - [Audit Trigger 91plus](https://wiki.postgresql.org/wiki/Audit_trigger_91plus)
    generic trigger function used for recording changes to tables into an audit
    log table
  - [pgMemento](https://github.com/pgMemento/pgMemento) provides an audit trail
    for your data inside a PostgreSQL database using triggers and server\-side
    functions written in PL/pgSQL
  - [Temporal Tables PostgreSQL Extension](https://github.com/arkhipov/temporal_tables)
- [pg_cron](https://github.com/citusdata/pg_cron) to run periodic jobs in
  PostgreSQL
- [shortkey](https://github.com/turbo/pg-shortkey) for YouTube-like Short IDs as
  Postgres Primary Keys
- [dexter](https://github.com/ankane/dexter) automatic indexer
- [message-db](https://github.com/message-db/message-db) message and event store
- [RecDB Recommendation Engine](https://github.com/DataSystemsLab/recdb-postgresql)
- [pg_similarity](http://www.postgresql.org/) extension to support similarity
  queries on PostgreSQL
- [dox Document Database API extension](https://github.com/robconery/dox) when
  needing simple JSON store
- [colpivot.sql](https://github.com/hnsl/colpivot) dynamic row to column
  pivotation/transpose
- [Guidance to implement NIST level 2 RBAC Hierarchical
  RBAC](https://github.com/morenoh149/postgresDBSamples/tree/master/role-based-access-control)
  in PostgreSQL
- [ldap2pg](https://github.com/dalibo/ldap2pg) to synchronize Postgres roles and
  privileges from YAML or LDAP
- [SeeQR](https://www.theseeqr.io/) database analytic tool to compare the
  efficiency of different schemas and queries on a granular level
- [postgres\-basename\-dirname](https://github.com/elfsternberg/postgres-basename-dirname)
  contains functions which provide equivalents to the POSIX functions basename
  and dirname
- [postgresql\-similarity](https://github.com/urbic/postgresql-similarity)
  extension package which provides functions that calculate similarity between
  two strings
- [pg\_median\_utils](https://github.com/greenape/pg_median_utils) functions
  like median_filter which behaves the same as SciPy's
  [medfilt](https://docs.scipy.org/doc/scipy-0.14.0/reference/generated/scipy.signal.medfilt.html)
- [orafce](https://github.com/orafce/orafce) ORACLE compatibility functions
- [postgres\-typescript](https://github.com/Portchain/postgres-typescript)
  generates typescript functions from SQL files and lets you call these
  functions from your app
- [SPARQL compiler functions for
  PostgreSQL](https://github.com/lacanoid/pgsparql)
- [PL/pgSQL implementation of hashids
  library](https://github.com/andreystepanov/hashids.sql), another alternative:
  [plpg\_hashids](https://github.com/array-analytics/plpg_hashids)
- [Helpers for PL/pgSQL applications](https://github.com/luk4z7/plpgsql-tools)
- [session\_variable](https://github.com/splendiddata/session_variable) Postgres
  database extension provides a way to create and maintain session scoped
  variables and constants, more or less like Oracle's global variables
- [Git Based Application Configuration](https://github.com/PaulHatch/konfigraf),
  a Postgres extension that allows you to store and manipulate data in Git
  repositories stored in tables within the database. This is designed to be used
  for storage of configuration data for applications and services.
- [PostgreSQL extension with support for version string
  comparison](https://github.com/repology/postgresql-libversion)

Engineers writing SQL-first code should use the following tools:

- [sqlcheck](https://github.com/jarulraj/sqlcheck) and
  [plpgsql_check](https://github.com/okbob/plpgsql_check) for linting SQL source
  code
- [pgTAP](https://pgtap.org/) - Database testing framework for Postgres
- [pgcmp](https://github.com/cbbrowne/pgcmp) for comparing Postgres database
  schemas
- [Web-based Explain Visualizer \(pev\)](https://github.com/AlexTatiyants/pev)
  and
  [CLI query visualizer (gocmdpev)](https://github.com/simon-engledew/gocmdpev)
  for performance optimization
- [JSON Schema validation for PostgreSQL](https://github.com/gavinwahl/postgres-json-schema)
  when using JSON and JSONB columns
- Use [readable database errors](https://github.com/Shyp/go-dberror) as a guide
  for creating errors in the database which can be used in the front-end
- [postgresqltuner](https://github.com/jfcoz/postgresqltuner) script to analyse
  PostgreSQL database configuration, and give tuning advice
- Use [HyperLogLog data structures](https://github.com/citusdata/postgresql-hll)
  and [TopN PostgreSQL extension](https://github.com/citusdata/postgresql-topn)
  for higher performing value counting when data amounts get large
- See [GraphQL for Postgres](https://github.com/solidsnack/GraphpostgresQL)
  which teaches techniques for how to parse GraphQL queries and transform them
  into SQL, all inside PostgreSQL (this is not production-level code but is good
  for education)
- [Plugin for prettier to support formatting of PostgreSQL\-flavour
  SQL](https://github.com/benjie/prettier-plugin-pg), including function bodies
  in SQL, pgSQL, PLV8, plpython, etc.

Engineers needing to instrument PostgreSQL:

- Deno [Postgres SQL parser](https://github.com/oguimbal/pgsql-ast-parser)
- [pg\_query 2\.0: The easiest way to parse Postgres
  queries](https://pganalyze.com/blog/pg-query-2-0-postgres-query-parser)

Machine Learning without leaving PostgreSQL:

- [Apache MADlib](https://madlib.apache.org/)
- [mindsdb.com](https://mindsdb.com/) for machine Learning without leaving the
  database

Content engineers who need datasets:

- [pgloader](https://pgloader.readthedocs.io/en/latest/index.html) loads data
  from various sources into PostgreSQL
- [ISO\-3166 \- All countries and subcountries in the
  world](https://github.com/morenoh149/postgresDBSamples)

Precision Knowledge:

- [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html)
- [Intuit’s Data Mesh Strategy](https://medium.com/intuit-engineering/intuits-data-mesh-strategy-778e3edaa017)
- [Web development platform built entirely in
  PostgreSQL](https://github.com/aquametalabs/aquameta)
- [Postgres Analytics \- Tips, best practices &
  extensions](https://github.com/swarm64/webinar-pg-analytics)
- [OWASP API Security Project](https://owasp.org/www-project-api-security/)
- [Beyond REST](https://netflixtechblog.com/beyond-rest-1b76f7c20ef6) is
  Netflix's approach to Rapid Development with GraphQL Microservices
- [6 Common Mistakes for SQL Queries that "Should be
  Working"](https://blog.arctype.com/6-common-mistakes-for-sql-queries/)
- [Postgres Notify for Real Time
  Dashboards](https://blog.arctype.com/postgres-notify-for-real-time-dashboards/)
- [Postgres regex search over 10,000 GitHub repositories \(using only a
  Macbook\)](https://devlog.hexops.com/2021/postgres-regex-search-over-10000-github-repositories)
- [How to Modernize Your Data & Analytics
  Platform](https://www.linkedin.com/pulse/part-1-3-how-modernize-your-data-analytics-platform-alaa/)
  parts
  [one](https://www.linkedin.com/pulse/part-1-3-how-modernize-your-data-analytics-platform-alaa),
  [two](https://www.linkedin.com/pulse/part-2-3-how-modernize-your-data-analytics-platform-alaa),
  [three](https://www.linkedin.com/pulse/part-3-4-toolkit-modernizing-transmission-system-data-alaa-mahjoub),
  and
  [four](https://www.linkedin.com/pulse/part-4-toolkit-modernizing-transmission-system-data-platform-mahjoub).

## Stateless, non-data-centric services, are out of scope

If a custom micro service is completely stateless and does not have anything to
do with reading or writing structured data, it should be written in TypeScript
hosted on Deno or other micro service using Microsoft Dapr sidecar.
