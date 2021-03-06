const driver = require('mssql');
const {SError, WError} = require('error');
const SqlSe = (() => (class Sql extends SError {}))();
const SqlWe = (() => (class Sql extends WError {}))();


const predefinedSql = require('./sqls/index.js');
const scaleOnly = [
    'smalldatetime',
    'datetime2',
    'datetimeoffset',
    'time'
];

const stringToType = (() => {
    const dateTypes = [
        'smalldatetime',
        'datetime2',
        'datetimeoffset',
        'time'
    ];
    return (type, value) => {
        if (
            dateTypes.indexOf(type) > -1 &&
            typeof value === 'string'
        ) {
            return new Date(value);
        } else if (type === 'varbinary') {
            return Buffer.from(value, 'utf8');
        }
        return value;
    };
})();

const conn = (() => {
    let connection = null;
    return async(config) => {
        if (connection === null) {
            connection = await driver.connect(config);
            return connection;
        }
        return connection;
    };
})();


const Link = async(config) => {
    const {
        server,
        user,
        password,
        database,
        pool,
        options
    } = config;
    const cPool = await conn({
        server,
        user,
        password,
        pool,
        database,
        options
    });
    return {
        query: async(q) => {
            try {
                return await cPool.request().query(q);
            } catch (e) {
                console.warn(q);
                console.error(e);
                throw e;
            }
        },
        request: () => cPool.request()
    };
};


module.exports = async(config) => {
    let tableTypes = {};
    let methods = {};
    const link = await Link(config.connect);

    const predefinedQuery = async(key) => {
        if (!key) {
            throw SqlSe.create('noSuchSqlHelperFile');
        }
        return link.query(
            (await predefinedSql[key]).toString('utf8')
        );
    }

    const groupTTs = (list) => {
        return list.reduce((a, {
            name,
            userTypeId,
            column,
            ...c
        }) => {
            const el = a[userTypeId] || {
                columns: [],
                name,
                userTypeId
            };
            el.columns.push({...c, name: column});
            return {
                ...a,
                [userTypeId]: el
            };
        }, {});
    }

    const paramTT = ({length, scale, type}) => {
        const dataType = driver[type.toUpperCase()];
        if (!dataType) {
            throw SqlSe.create('unknownTTParameterType');
        }
        if (typeof length === 'string' && length.toUpperCase() === 'MAX') {
            return dataType(driver.MAX);
        } else {
            return dataType(
                (length !== null && Number.parseInt(length)) ||
                length,
                scale
            );
        }
    }

    const createTT = ({name: tableName, columns}) => {
        return () => {
            const table = new (driver.Table)(
                tableName.toLowerCase()
            );
            return columns
                .reduce((t, {name, ...c}) => {
                    t.columns.add(name, paramTT(c));
                    return t;
                }, table);
        };
    }

    const checkValueTT = ({columns}) => {
        return columns
            .reduce((a, {name, ...c}) => ({
                ...a,
                [name]: (value) => {
                    if (
                        value === undefined &&
                        !c.isNullable
                    ) {
                        return c.default;
                    }
                    return value;
                }
            }), {});
    }

    const createTTs = (hashMap) => {
        return Object.keys(hashMap)
            .reduce((a, id) => {
                return {
                    ...a,
                    [id]: {
                        create: createTT(
                            hashMap[id]
                        ),
                        checkColumnValue: checkValueTT(
                            hashMap[id]
                        )
                    }
                };
            }, {});
    }

    const parameter = ({
        params: {precision, type, scale, tableType, ...paramsRest},
        values
    }) => {
        const dataType = driver[type.toUpperCase()];
        const typeLow = type.toLowerCase();
        if (dataType) {
            const valTrans = ((values === undefined) &&
                []) || stringToType(typeLow, values);
            if (scaleOnly.indexOf(typeLow) > -1) {
                return [dataType(scale)]
                    .concat(valTrans);
            }
            return [dataType(precision, scale)]
                .concat(valTrans);
        } else if (tableType) {
            if (!Array.isArray(values)) {
                throw SqlSe.create('TTValueShouldBeArray', {
                    name: paramsRest.name
                });
            }
            return [
                values.reduce((t, v) => {
                    const rows = t.columns
                        .map(({name, ...rest}) =>
                            tableType.checkColumnValue[name](v[name])
                        );
                    t.rows.add(...rows);
                    return t;
                }, tableType.create())
            ];
        } else {
            throw SqlSe.create('unknownSpParamType');
        }
    }

    const registerMethod = ({
        name,
        args: {
            name: procedure,
            params: procedureParams
        } = {}
    }) => {
        methods[name] = async(
            callParams
        ) => {
            const paramsNameList = Object
                .keys(callParams);
            try {
                const request = link.request();
                request.multiple = true;

                callParams && paramsNameList
                    .reduce((a, key) => {
                        if (procedureParams[key] && (callParams[key] !== undefined)) {
                            const valueType = parameter({
                                params: procedureParams[key],
                                values: callParams[key]
                            });
                            valueType && a.input(
                                ...[key].concat(valueType)
                            );
                        }
                        return a;
                    }, request);
                return await request.execute(procedure);
            } catch (e) {
                throw SqlWe.wrap(
                    'procedureCall',
                    e,
                    {
                        procedure,
                        callParams: paramsNameList.join(';')
                    }
                );
            }
        };
    }

    const storedProcedures = async() => {
        const schemas = []
            .concat(config.link.SP.schemas);

        const qr = await predefinedQuery(
            'internalMethod'
        );

        const procList = qr.recordset.reduce((procedures, {
            name,
            userTypeId,
            column,
            type,
            length,
            precision,
            scale,
            default: defaultValue,
            schema,
            isNullable,
            isOutput
        }) => {
            if (isOutput) {
                return procedures;
            }
            if (schemas.indexOf(schema) < 0) {
                return procedures;
            }
            const pn = [schema, name].join('.');
            const callName = [`[${schema}]`, `[${name}]`].join('.');
            const pProps = procedures[pn] || {};
            const newParam = {};
            if (column) {
                const paramClean = column.slice(1);
                newParam[paramClean] = {
                    name: paramClean,
                    type,
                    isOutput,
                    tableType: tableTypes[userTypeId],
                    precision,
                    scale,
                    defaultValue,
                    isNullable,
                    length
                };
            }

            return {
                ...procedures,
                [pn]: {
                    name: callName,
                    params: (
                        pProps.params &&
                        {...pProps.params, ...newParam}
                    ) || newParam
                }
            };
        }, {});

        Object.keys(procList)
            .map((name) => registerMethod({
                name: ['$procedure$', name].join('.'),
                args: procList[name]
            }));
    }

    const extractTTs = async() => {
        const qr = await predefinedQuery(
            'tableTypes'
        );

        tableTypes = createTTs(
            groupTTs(qr.recordset)
        );
    };

    const linkStoredProcedures = async() => {
        await extractTTs();
        await storedProcedures();
    }

    await linkStoredProcedures();

    return methods;
};
