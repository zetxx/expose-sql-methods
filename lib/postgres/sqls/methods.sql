SELECT
    nspname "schema",
	proname "name",
	pronargs ninargs,
    pronargdefaults nargdefaults,
    prorettype rettype,
    proargtypes inargtypes,
    proallargtypes allargtypes,
    proargnames argnames,
    proargmodes argmodes
FROM 
    pg_catalog.pg_namespace n
JOIN 
    pg_catalog.pg_proc p ON 
    p.pronamespace = n.oid
WHERE 
	nspname  not IN ('pg_catalog', 'information_schema')

