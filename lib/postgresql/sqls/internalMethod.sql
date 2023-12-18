SELECT
    OBJECT_SCHEMA_NAME([SYSPROC].object_id) [schema],
    [SYSPROC].name name,
    [SYSPROC].object_id objectId,
    [SYSPARAMS].name AS [column],
    TYPE_NAME([SYSPARAMS].user_type_id) AS [type],
    [SYSPARAMS].max_length AS length,
    CASE
        WHEN TYPE_NAME([SYSPARAMS].system_type_id) = 'uniqueidentifier'
        THEN [SYSPARAMS].PRECISION
        ELSE OdbcPrec([SYSPARAMS].system_type_id, [SYSPARAMS].max_length, [SYSPARAMS].PRECISION)
    END AS [precision],
    OdbcScale([SYSPARAMS].system_type_id, [SYSPARAMS].scale) AS [scale],
    [SYSPARAMS].parameter_id AS [order],
    [SYSPARAMS].user_type_id AS userTypeId,
    [SYSPARAMS].is_output AS isOutput
FROM
    sys.procedures [SYSPROC]
LEFT JOIN
    sys.parameters [SYSPARAMS] ON [SYSPARAMS].object_id = [SYSPROC].object_id
