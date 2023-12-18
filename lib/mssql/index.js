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
    let connection;
    return async(config) => {
        if (connection === undefined) {
            connection = await driver.connect(config);
            return connection;
        }
        return connection;
    };
})();


const Link = async(config) => {
    const cPool = await conn(config);
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
    const {gluePrefix = '.'} = config;
    const link = await Link(config.connect);

    const predefinedQuery = async(key) => {
        if (!key) {
            throw SqlSe.create('noSuchSqlHelperFile');
        }
        const q = (await predefinedSql[key]).toString('utf8');
        return link.query(
            q
        );
    }

    const groupTTs = (list) => {
        return list.reduce((type, {
            name,
            userTypeId,
            column,
            ...c
        }) => {
            const columns = type[userTypeId]?.columns || [];
            return {
                ...type,
                [userTypeId]: {
                    columns: columns.concat([{...c, name: column}]),
                    name,
                    userTypeId
                }
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

    const buildParam = ({
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

    const executable = ({
        name: procedure,
        params: definedParams
    } = {}) => {
        return async(params) => {
            const paramsKey = Object.keys(params);

            try {
                const request = link.request();
                request.multiple = true;

                params && paramsKey
                    .reduce((request, key) => {
                        if (definedParams[key] && (params[key] !== undefined)) {
                            const valueType = buildParam({
                                params: definedParams[key],
                                values: params[key]
                            });
                            valueType && request.input(
                                ...[key].concat(valueType)
                            );
                        }
                        return request;
                    }, request);
                return await request.execute(procedure);
            } catch (e) {
                throw SqlWe.wrap(
                    'procedureCall',
                    e,
                    {
                        procedure,
                        callParams: paramsKey.join(';')
                    }
                );
            }
        };
    }

    const build = async(tableTypes) => {
        const linkOnly = [].concat(config.link.schema);

        const qr = await predefinedQuery('internalMethod');

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
            if (isOutput || linkOnly.indexOf(schema) < 0) {
                return procedures;
            }
            const pn = [schema, name].join(gluePrefix);
            const callName = [`[${schema}]`, `[${name}]`].join(gluePrefix);
            const params = {...(procedures[pn]?.params || {})};
            if (column) {
                const paramClean = column.slice(1);
                params[paramClean] = {
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
                    params
                }
            };
        }, {});

        return Object.keys(procList)
            .reduce((procs, name) => ({
                ...procs,
                [name]: executable(procList[name])
            }), {});
    }

    const tableTypes = async() => {
        const qr = await predefinedQuery(
            'tableTypes'
        );

        return createTTs(
            groupTTs(qr.recordset)
        );
    };

    const tt = await tableTypes();
    const methods = await build(tt);

    return methods;
};
