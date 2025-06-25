## Database Edit

During development of MVP - We develop database first.
It's common convention with TypeORM and NestJs to code-first, database resync

_WE WILL NOT BE DOING THAT._

On rare occasion database needs to be edited, we will do that in its own workflow and return to current workflow and resync code to database. DATABASE SCHEMA WILL FOREVER BY SOURCE OF TRUTH.

## Error Catching

Catch only the errors you know how to handle
ALWAY check error type by looking at [error].constructor.name (or use instanceof).
No error should 'caught' and handled without knowing the type.

We will create 'global error handlers' to handle generic errors (Nest probably has them already).

## Type names and declarations

All type names should begin 'T' as in 'TSomeAwesomeType'
All types should be exported/imported using 'type' example: `import type {TSomeAwesomeType}`, `export type {TSomeAwesomeType}`

## Export/Import

- We prefer not to use default export
- We prefer name each/every export
- We prefer list all exported items at the bottom of the file

Example:

```
type TSomeAwesomeType = {};
class TheAwesomeClass {};

export {TheAwesomeClass};
export type {TSomeAwesomeClass};

```

Hence there should only be one export for actual things and one export types for any file. Meaning there should not be multiple 'export' in any file

# Move Files

When instructed to move documents use bash `mv`, DO NOT rewrite the file. If there are many files consider a bash script.
