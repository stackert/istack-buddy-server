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
