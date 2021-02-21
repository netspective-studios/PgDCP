# PostgreSQL Data Computing Platform (PgDCP)

PgDCP is Netspective's approach for using PostgreSQL to host polyglot stored procedures, stored functions, and other objects through Postgraphile, Hasura, and PostgREST. Using PostgreSQL whenever possible is called our _Zero Middleware_ automated backend as a service (AutoBaaS) strategy. AutoBaaS helps us eliminate signficant amounts of GraphQL and REST boilerplate code plus reduces the number of microservices we need to deploy and manage. 

_Zero Middleware_ is not tool or framework but an approach to reducing data-centric code surfaces to just PostgreSQL, with automatic and auto-generated, secure GraphQL and REST endpoints whenever possible. For use cases when higher-performance or more secure interfaces are necessary, direct access to tables, views, and stored routines using PostgreSQL wire protocol is encouraged.

We use `psql` and pure-Postgres migrations as Database as Code (“DaC”) for DDL, DQL, DML, etc. when possible. Instead of relying on 3rd party dependencies for schema migrations, we use PostgreSQL-first stored routines themselves along with `psql` to manage idempotent migrations. 

The overall objective for PgDCP is to reduce the number of tools that a developer needs to know down to just PostgreSQL and `psql` along with SQL and PL/* hosted languages for all services.

## Polyglot but SQL-first

Our first choice of languages for writing data-centric micro services should be:

* Pure SQL views, materialized views, and stored routines using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).
* pgSQL views and materialized views and PL/pgSQL stored functions and stored procedures when pure SQL is not possible, using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

In case SQL or PL/pgSQL is not appropriate:

* PL/Rust, PL/Java, PL/Go or other type-safe PostgreSQL-hosted language should be prioritized.
* If type-safety is not possible or 3rd party libraries access is more important than type-safety then PL/Python, PL/Perl, and other languages should be considered.
* The choice of language should depend on how easy the functionality can be expressed using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

## Information Assurance and Security in the Database

PgDCP requires _database-first_ security, which means PostgreSQL schemas, users, roles, permissions, and row-level security (RLS) should drive all data security requirements. Role-based access control (RBAC) and attribute based access control (ABAC) should be implemented in PostgreSQL stored routines.

## GraphQL-first but REST-capable

All micro services code in PostgreSQL tables, views, functions and stored procedures will be surfaced through Postgraphile GraphQL first but our AutoBaaS requirements are that all services should be exposed through safe and secure REST interfaces as a fallback for non-GraphQL clients. We favor Postgraphile GraphQL because it generates code which honors PostgreSQL security, roles, and unique features more faithfully than other utilities such as Hasura. 

## Assurance as Code

All code in PostgreSQL should be tested, or assured, with pgTAP code. All Assurance Engineering Cases (AECs) should be written code-first, not human-first (what we call  _Assurance as Code_).

## Stateless, non-data-centric services are out of scope

If a custom micro service is completely stateless and does not have anything to do with reading or writing structured data, it should be written in TypeScript hosted on Deno or other micro service using Microsoft Dapr sidecar.

## Software Engineering Tools

Platform and site reliability engineers should review:

* [psql command line tutorial and cheat sheet](https://github.com/tomcam/postgres)
* [Postgres features showcase \(commented SQL samples\)](https://github.com/cybertec-postgresql/postgres-showcase)
* [postgres_dba](https://github.com/NikolayS/postgres_dba) set of useful tools for Postgres DBAs and all engineers

Engineers writing applications should consider:

* [shortkey](https://github.com/turbo/pg-shortkey) for YouTube-like Short IDs as Postgres Primary Keys
* [RecDB Recommendation Engine](https://github.com/DataSystemsLab/recdb-postgresql)
* [dox Document Database API extension](https://github.com/robconery/dox) when needing simple JSON store
* [colpivot.sql](https://github.com/hnsl/colpivot) dynamic row to column pivotation/transpose

Engineers writing SQL-first code should use the following tools:

* [Web-based Explain Visualizer \(pev\)](https://github.com/AlexTatiyants/pev) and [CLI query visualizer (gocmdpev)](https://github.com/simon-engledew/gocmdpev) for performance optimization
* [JSON Schema validation for PostgreSQL](https://github.com/gavinwahl/postgres-json-schema) when using JSON and JSONB columns
* Use [readable database errors](https://github.com/Shyp/go-dberror) as a guide for creating errors in the database which can be used in the front-end
* Use [HyperLogLog data structures](https://github.com/citusdata/postgresql-hll) and [TopN PostgreSQL extension](https://github.com/citusdata/postgresql-topn) for higher performing value counting when data amounts get large
