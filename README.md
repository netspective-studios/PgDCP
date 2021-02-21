# PostgreSQL Distributed Data Computing Platform (PgDCP)

PgDCP is Netspective's approach for using PostgreSQL to host polyglot stored procedures, stored functions, and other objects through Postgraphile, Hasura, and PostgREST. Using PostgreSQL whenever possible is called our _Zero Middleware_ strategy, which helps us reduce the number of microservices we need to deploy and manage. We use `psql` and pure-Postgres migrations as Database as Code (“DaC”) for all DDL, DQL, DML, etc. when possible. 

Our choices of languages for hosting micro services should be:

* Pure SQL whenever possible
* PL/pgSQL when pure SQL is not possible 
* PL/Java, PL/Python when PL/pgSQL will create too much code or would be harder to test 
* TypeScript on Deno runtime when SQL or PL/pgSQL is not possible

All code in PostgreSQL should be tested with pgTAP.
