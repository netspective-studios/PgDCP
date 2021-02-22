# PostgreSQL Data Computing Platform (PgDCP)

PgDCP is Netspective's approach for using PostgreSQL to host tables, views, plus polyglot stored routines and surface them as GraphQL and REST using Postgraphile, Hasura, and PostgREST (or [pREST](https://github.com/prest/prest)). Using PostgreSQL whenever possible is called our _Zero Middleware_ automated backend as a service (AutoBaaS) strategy. AutoBaaS helps us eliminate signficant amounts of GraphQL and REST boilerplate code plus reduces the number of microservices we need to deploy and manage. 

_Zero Middleware_ is not tool or framework but an approach to reducing data-centric code surfaces to just PostgreSQL, with automatic and auto-generated, database-first _secure_ GraphQL and REST endpoints whenever possible. For use cases when higher-performance or more secure interfaces are necessary, direct access to tables, views, and stored routines using PostgreSQL wire protocol is encouraged.

We use `psql` and pure-Postgres migrations as Database as Code (“DaC”) for DDL, DQL, DML, etc. when possible. Instead of relying on 3rd party dependencies for schema migrations, we use PostgreSQL-first stored routines themselves along with `psql` to manage idempotent migrations. 

The overall objective for PgDCP is to reduce the number of tools that a developer needs to know down to just PostgreSQL and `psql` along with SQL and PL/* hosted languages for all services.

## Polyglot but SQL-first

Our first choice of languages for writing data-centric micro services should be:

* Pure SQL views, materialized views, and stored routines using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).
* pgSQL views and materialized views and PL/pgSQL stored functions and stored procedures when pure SQL is not possible, using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

In case SQL or PL/pgSQL is not appropriate:

* PL/Rust, PL/Java, PL/Go, [PL/Deno](https://github.com/supabase/postgres-deno) or other type-safe PostgreSQL-hosted language should be prioritized.
* If type-safety is not possible or 3rd party libraries access is more important than type-safety then PL/Python, PL/Perl, and other languages should be considered.
  * When using PL/Python or other language with package managers, consider using guidance such as [programmatic access to PIP modules](http://jelly.codes/articles/python-pip-module/) so that PostgreSQL server admins are not required for administering module dependencies
* The choice of language should depend on how easy the functionality can be expressed using [Postgraphile Schema Design](https://www.graphile.org/postgraphile/postgresql-schema-design/).

## Information Assurance and Security _in the Database_

PgDCP requires _database-first_ security, which means PostgreSQL schemas, users, roles, permissions, and row-level security (RLS) should drive all data security requirements. Role-based access control (RBAC) and attribute based access control (ABAC) should be implemented in PostgreSQL stored routines. If necessary, [ldap2pg](https://github.com/dalibo/ldap2pg) can be used to synchronize roles with LDAP.

## GraphQL-first but REST-capable

All micro services code in PostgreSQL tables, views, functions and stored procedures will be surfaced through Postgraphile GraphQL first but our AutoBaaS requirements are that all services should be exposed through safe and secure REST interfaces via PostgREST (or [pREST](https://github.com/prest/prest)) as a fallback for non-GraphQL clients. We favor Postgraphile's GraphQL API because it generates code which honors PostgreSQL security, roles, and unique features more faithfully than other utilities such as Hasura. 

## Assurance as Code

All code in PostgreSQL should be tested, or _assured_, with pgTAP code. All _Assurance Engineering Cases_ (AECs) should be written code-first, not human-first (what we call  _Assurance as Code_).

## Microsoft Excel-first UX but client-independent

Microsoft Excel should be the first UI that all data access should be designed for when accessing outside of developer-centric PgDCP use cases. If Excel can properly show your data, in a safe, secure, and performant way, then every other client can also do so. Excel-first UX should target "live ODBC" use cases where the database is directly accessed using PostgreSQL binary protocol.

## PgDCP Engineering Resources

Platform and site reliability engineers should review:

* [psql command line tutorial and cheat sheet](https://github.com/tomcam/postgres)
* [Postgres features showcase \(commented SQL samples\)](https://github.com/cybertec-postgresql/postgres-showcase)
* [postgres_dba](https://github.com/NikolayS/postgres_dba) set of useful tools for Postgres DBAs and all engineers
* [Set of Practices](https://kukuruku.co/post/postgresql-set-of-practices/) for common PG engineering suggestions
* [pgcenter](https://github.com/lesovsky/pgcenter) CLI tool for observing and troubleshooting Postgres
* [PGXN client](https://github.com/pgxn/pgxnclient) CLI tool to interact with the PostgreSQL Extension Network

Engineers writing stored routines (functions, SPs) should review:

* [Boost your User-Defined Functions in PostgreSQL](https://www.ongres.com/blog/boost-your-user-defined-functions-in-postgresql/) describes some useful techniques for improving UDFs.

Engineers writing applications should consider these PostgreSQL-native libraries:

* [ltree](https://www.postgresql.org/docs/13/ltree.html) for representing labels of data stored in a hierarchical tree\-like structure
* [pg_trgm](https://www.postgresql.org/docs/11/pgtrgm.html) module provides functions and operators for determining the similarity of alphanumeric text based on trigram matching
* [Audit Trigger 91plus](https://wiki.postgresql.org/wiki/Audit_trigger_91plus) generic trigger function used for recording changes to tables into an audit log table
* [pg_cron](https://github.com/citusdata/pg_cron) to run periodic jobs in PostgreSQL
* [shortkey](https://github.com/turbo/pg-shortkey) for YouTube-like Short IDs as Postgres Primary Keys
* [dexter](https://github.com/ankane/dexter) automatic indexer
* [message-db](https://github.com/message-db/message-db) message and event store
* [RecDB Recommendation Engine](https://github.com/DataSystemsLab/recdb-postgresql)
* [pg_similarity](http://www.postgresql.org/) extension to support similarity queries on PostgreSQL
* [dox Document Database API extension](https://github.com/robconery/dox) when needing simple JSON store
* [colpivot.sql](https://github.com/hnsl/colpivot) dynamic row to column pivotation/transpose
* [Guidance to implement NIST level 2 RBAC Hierarchical RBAC](https://github.com/morenoh149/postgresDBSamples/tree/master/role-based-access-control) in PostgreSQL
* [ldap2pg](https://github.com/dalibo/ldap2pg) to synchronize Postgres roles and privileges from YAML or LDAP

Engineers writing SQL-first code should use the following tools:

* [sqlcheck](https://github.com/jarulraj/sqlcheck) and [plpgsql_check](https://github.com/okbob/plpgsql_check) for linting SQL source code
* [pgTAP](https://pgtap.org/) - Database testing framework for Postgres
* [pgcmp](https://github.com/cbbrowne/pgcmp) for comparing Postgres database schemas
* [Web-based Explain Visualizer \(pev\)](https://github.com/AlexTatiyants/pev) and [CLI query visualizer (gocmdpev)](https://github.com/simon-engledew/gocmdpev) for performance optimization
* [JSON Schema validation for PostgreSQL](https://github.com/gavinwahl/postgres-json-schema) when using JSON and JSONB columns
* Use [readable database errors](https://github.com/Shyp/go-dberror) as a guide for creating errors in the database which can be used in the front-end
* [postgresqltuner](https://github.com/jfcoz/postgresqltuner) script to analyse PostgreSQL database configuration, and give tuning advice
* Use [HyperLogLog data structures](https://github.com/citusdata/postgresql-hll) and [TopN PostgreSQL extension](https://github.com/citusdata/postgresql-topn) for higher performing value counting when data amounts get large
* See [GraphQL for Postgres](https://github.com/solidsnack/GraphpostgresQL) which teaches techniques for how to parse GraphQL queries and transform them into SQL, all inside PostgreSQL (this is not production-level code but is good for education)

Engineers needing to instrument PostgreSQL:

* Deno [Postgres SQL parser](https://github.com/oguimbal/pgsql-ast-parser)

Machine Learning without leaving PostgreSQL:

* [Apache MADlib](https://madlib.apache.org/)
* [mindsdb.com](https://mindsdb.com/) for machine Learning without leaving the database

Content engineers who need datasets:

* [pgloader](https://pgloader.readthedocs.io/en/latest/index.html) loads data from various sources into PostgreSQL
* [ISO\-3166 \- All countries and subcountries in the world](https://github.com/morenoh149/postgresDBSamples)

## Stateless, non-data-centric services, are out of scope

If a custom micro service is completely stateless and does not have anything to do with reading or writing structured data, it should be written in TypeScript hosted on Deno or other micro service using Microsoft Dapr sidecar.

