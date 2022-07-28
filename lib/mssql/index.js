const {SError, WError} = require('error');
const SqlSe = (() => (class Sql extends SError {}))();
const SqlWe = (() => (class Sql extends WError {}))();


const sql = require('./sqls/index.js');
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

module.exports = (args) => {
    return class mssql {
        constructor() {
            this.tableTypes = {};
            this.methods = this.methods || {};
        }

        async extractTTs() {
            const qr = await this.predefinedQuery(
                'tableTypes'
            );

            this.tableTypes = this.createTTs(
                this.groupTTs(qr.recordset)
            );
        }

        async storedProcedures() {
            const schemas = []
                .concat(this.config.link.SP.schemas);

            const qr = await this.predefinedQuery(
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
                        tableType: this.tableTypes[userTypeId],
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
                .map((name) => this.registerMethod({
                    name: ['$procedure$', name].join('.'),
                    args: procList[name]
                }));
        }

        async linkStoredProcedures() {
            await this.extractTTs();
            await this.storedProcedures();
        }

        async predefinedQuery(key) {
            if (!key) {
                throw SqlSe.create('noSuchSqlHelperFile');
            }
            return this.link.query(
                (await sql[key]).toString('utf8')
            );
        }

        groupTTs(list) {
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

        createTTs(hashMap) {
            return Object.keys(hashMap)
                .reduce((a, id) => {
                    return {
                        ...a,
                        [id]: {
                            create: this.createTT(
                                hashMap[id]
                            ),
                            checkColumnValue: this.checkValueTT(
                                hashMap[id]
                            )
                        }
                    };
                }, {});
        }

        createTT({name: tableName, columns}) {
            return () => {
                const table = new (this.driver.Table)(
                    tableName.toLowerCase()
                );
                return columns
                    .reduce((t, {name, ...c}) => {
                        t.columns.add(name, this.paramTT(c));
                        return t;
                    }, table);
            };
        }

        checkValueTT({columns}) {
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

        paramTT({length, scale, type}) {
            const dataType = this.driver[type.toUpperCase()];
            if (!dataType) {
                throw SqlSe.create('unknownTTParameterType');
            }
            if (typeof length === 'string' && length.toUpperCase() === 'MAX') {
                return dataType(this.driver.MAX);
            } else {
                return dataType(
                    (length !== null && Number.parseInt(length)) ||
                    length,
                    scale
                );
            }
        }

        parameter({
            params: {precision, type, scale, tableType, ...paramsRest},
            values
        }) {
            const dataType = this.driver[type.toUpperCase()];
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

        registerMethod({
            name,
            args: {
                name: procedure,
                params: procedureParams
            } = {}
        }) {
            this.methods[name] = async(
                callParams,
                meta
            ) => {
                const paramsNameList = Object
                    .keys(callParams);
                try {
                    const request = this.link.request();
                    request.multiple = true;

                    callParams && paramsNameList
                        .reduce((a, key) => {
                            if (procedureParams[key] && (callParams[key] !== undefined)) {
                                const valueType = this.parameter({
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

        async transformResponse({recordsets, recordset, ...data}) {
            if (recordsets.length === 1) {
                return [...recordset];
            } else if (
                Array.isArray(recordsets) &&
                recordsets[0] &&
                recordsets[0].columns &&
                recordsets[0].columns.resultSet
            ) {
                return recordsets.reduce((res, curr, idx, arr) => {
                    if (curr.columns.resultSet) {
                        return {
                            ...res,
                            [curr[0].resultSet]: []
                        };
                    } else {
                        const resultSet = (arr[idx - 1][0] &&
                        arr[idx - 1][0].resultSet) || 'orphan';
                        return {
                            ...res,
                            [resultSet]:
                                res[resultSet].concat([...curr])
                        };
                    }
                }, {orphan: []});
            } else {
                return recordsets.map((rs) => [...rs]);
            }
        }
    };
};
