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

## GraphQL-first but REST-capable

All micro services code in PostgreSQL tables, views, functions and stored procedures will be surfaced through Postgraphile GraphQL first but our AutoBaaS requirements are that all services should be exposed through safe and secure REST interfaces as a fallback for non-GraphQL clients. We favor Postgraphile GraphQL because it generates code which honors PostgreSQL security, roles, and unique features more faithfully than other utilities such as Hasura. 

## Assurance as Code

All code in PostgreSQL should be tested, or assured, with pgTAP code. All Assurance Engineering Cases (AECs) should be written code-first, not human-first (what we call  _Assurance as Code_).

## Stateless, non-data-centric services are out of scope

If a custom micro service is completely stateless and does not have anything to do with reading or writing structured data, it should be written in TypeScript hosted on Deno or other micro service using Microsoft Dapr sidecar.
