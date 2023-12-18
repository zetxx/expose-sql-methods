SELECT
    SCHEMA_NAME(types.schema_id) + '.' + types.name name,
    c.name [column],
    st.name type,
    CASE
        WHEN st.name IN ('decimal', 'numeric') THEN CAST(c.[precision] AS VARCHAR)
        WHEN st.name IN ('datetime2', 'time', 'datetimeoffset') THEN CAST(c.[scale] AS VARCHAR)
        WHEN st.name IN ('varchar', 'varbinary', 'char', 'binary') AND c.max_length >= 0 THEN CAST(c.max_length AS VARCHAR)
        WHEN st.name IN ('nvarchar', 'nchar') AND c.max_length >= 0 THEN CAST(c.max_length / 2 AS VARCHAR)
        WHEN st.name IN ('varchar', 'varbinary', 'char', 'binary', 'nvarchar', 'nchar') AND c.max_length < 0 THEN 'max'
    END [length],
    CASE
        WHEN st.name IN ('decimal', 'numeric') THEN c.scale
    END scale,
    OBJECT_DEFINITION(c.default_object_id) [default],
    types.user_type_id AS userTypeId,
    c.is_nullable AS isNullable
FROM
    sys.table_types types
JOIN
    sys.columns c ON types.type_table_object_id = c.object_id
JOIN
    sys.systypes AS st ON st.xtype = c.system_type_id
WHERE
    types.is_user_defined = 1 AND st.name <> 'sysname'
ORDER BY
    1, c.column_id
