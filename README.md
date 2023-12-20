# Expose sql methods as nodejs methods

## arguments

- every method that is called should consist on only 1 argument 
 of type object, in it should be passed every argument of sql function,procedure ... etc

- mssql
  - main: ok
  - transactions: pending
- mysql: pending
- postgres:
  - main: ok
  - transactions: ok
- sqlite: pending

[![Build Status](https://travis-ci.com/zetxx/expose-sql-methods.svg?branch=master)](https://travis-ci.com/zetxx/expose-sql-methods)
