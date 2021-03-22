# PgDCP SQL Assembler (`SQLa`)

Since the PostgreSQL Data Computing Platform (PgDCP) leverages SQL for its functionality, assembling and loading SQL in a deterministically reproducible manner is crucial. The PgDCP *SQL Assembler* (`SQLa`) is a Deno TypeScript module which uses the power of JavaScript [Template literals (Template strings)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) to create SQL components as building blocks. Instead of inventing yet another template language, `SQLa` uses a set of naming conventions plus the full power of JavaScript (and TypeScript) Template strings to prepare the final SQL that will be loaded into the database.

## Terms

* **Schema**. A typical PostgreSQL schema.
* **Affinity Group** (**AG**). A group of SQL objects that are related by subject; each schema may have one or more subject-based affinity groups. Affinity groups allow `SQLa` to combine multiple subjects into a single schema during assembly. 
  * A schema is also considered, conceptually, an affinity group. This is helpful since any affinity group may just be deployed by itself into a single schema or combined with other AGs into a single schema. When referencing an AG *or* schema we use **AGorS** below.
* **Context**. Execution environments such as `sandbox`, `devl`, `test`, and `production` are *examples* of contexts. The nature of Context is usage-dependent and should be documented with  assets/objects. For example, a context can be extended with dot-notation (e.g. `production.[account]` meaning this context is for *production* for a specific *account*).
  * `sandbox` and `devl` are considered *experimental* contexts and should only contain synthetic or generated data.
  * `test` may also be considered *experimental*, especially if all data is synthetic. If `test` databases include copies of production data that are not anonymized they are considered `confidential experimental` data.

## Stored Procedures

By convention, all SQL is created within the following *types* of stored procedures within *affinity groups* (or *schemas*):

* `[AGorS]_construct`. Responsible for the creation of all objects related to a schema or AG.
* `[AGorS]_destroy`. Responsible for the destruction of all objects related to a schema or AG.
* `[AGorS]_test_*`. pgTAP unit tests for objects related to a schema or AG.
* `[AGorS]_populate_secrets`. Responsbile for populating confidential data related to the objects.
* `[AGorS]_populate_seed_data`. Responsbile for populating seed data used across all contexts.
* `[AGorS]_populate_[context]_data`. Responsbile for populating context-specific data that is not transactional in nature.
  * `[AGorS]_populate_experimental_data`. Responsbile for populating experimental (test/devl/sandbox) data which is not used for production database.

`[AGorS]_` can be *either* an *affinity group* name _or_ a *schema* name.

# TODOs

* Add `asset_version` table which has context, path, and version. This allows us to check whether an *object* (or *asset*) is at a particular version.
* Add `[AGorS]_construct`. Responsible for the creation of all objects related to a schema or AG.
