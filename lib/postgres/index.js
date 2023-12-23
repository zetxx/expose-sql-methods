const {Pool} = require('pg');
const {SError, WError} = require('error');
const SqlSe = (() => (class Sql extends SError {}))();
const SqlWe = (() => (class Sql extends WError {}))();


const predefinedSql = require('./sqls/index.js')();

const conn = (() => {
    let connection;
    return async(config) => {
        if (connection === undefined) {
            connection = new Pool(config);
            return connection;
        }
        return connection;
    };
})();


module.exports = async(config) => {
    const {link: {gluePrefix = '.', schemas: sc} = {}} = config;
    const schemas = sc instanceof Array ? sc : [sc];
    const link = await conn(config.connection);
    const txMap = new Map();
    let txId = 0;

    /**
     * Description
     * @param {string} key
     * @throws {SqlWe}
     * @returns {Object[]}
     */
    const predefinedQuery = async(key) => {
        if (!key) {
            throw SqlSe.create('noSuchSqlHelperFile');
        }
        try {
            const q = (await predefinedSql)[key];
            const r = await link.query(q);
            return r.rows;
        } catch (e) {
            throw SqlWe.wrap(
                'sqlHelper',
                e,
                {
                    key,
                    query: e.query
                }
            );
        }
    }

    const types = (() => {
        let cache;
        return async() => {
            if (!cache) {
                cache = (await predefinedQuery('types')).rows;
            }
            return cache;
        };
    })();
    // https://www.postgresql.org/docs/current/catalog-pg-proc.html
    const buildArgs = (argnames, argmodesText) => {
        const argmodes = (!argmodesText && argnames.map(() => 'i')) || argmodesText
            .split('{').join('')
            .split('}').join('')
            .split(',');
        return argnames
            .reduce((args, arg, idx) => {
                const mode = (argmodes && argmodes[idx]) || 'i';
                const gm = (mode === 'i' && 'input') || 'other';
                const argRdy = {name: arg, mode};
                return {
                    ...args,
                    [gm]: (args[gm] || []).concat([argRdy]),
                    all: args.all.concat([argRdy])
                };
            }, {input: [], other: [], all: []});
    };

    const build = async() => {
        const allTypes = await types();
        const methods = (await predefinedQuery('methods'));
        return methods
            .filter(({schema}) => schemas.indexOf(schema) > -1)
            .reduce((methods, {
                schema,
                name,
                ninargs, // number of input args
                nargdefaults, // number of args with default value
                rettype, // return type
                inargtypes, // An array of the data types of the function arguments. This includes only input arguments (including INOUT and VARIADIC arguments), and thus represents the call signature of the function.
                allargtypes, // An array of the data types of the function arguments. This includes all arguments (including OUT and INOUT arguments); however, if all the arguments are IN arguments, this field will be null. Note that subscripting is 1-based, whereas for historical reasons proargtypes is subscripted from 0.
                argnames, // An array of the names of the function arguments. Arguments without a name are set to empty strings in the array. If none of the arguments have a name, this field will be null. Note that subscripts correspond to positions of proallargtypes not proargtypes.
                argmodes // An array of the modes of the function arguments, encoded as i for IN arguments, o for OUT arguments, b for INOUT arguments, v for VARIADIC arguments, t for TABLE arguments. If all the arguments are IN arguments, this field will be null. Note that subscripts correspond to positions of proallargtypes not proargtypes.
            }) => {
                const jsName = [schema, name].join(gluePrefix);
                const sqlName = [`"${schema}"`, `"${name}"`].join('.');
                const args = buildArgs(argnames, argmodes);
                const fillArgs = args.input
                    .map((v, idx) => `$${idx + 1}`).join(',');
                return {
                    ...methods,
                    /**
                     * Description
                     * @param {Object} arguments
                     * @param {number} txId
                     * @returns {any}
                     */
                    [jsName]: async(arguments, txId) => {
                        const dynArgs = args.input.map(({name}) => {
                            if (arguments[name] === undefined) {
                                throw SqlSe.create(
                                    'argumentNotFound',
                                    {fn: jsName, argument: name}
                                );
                            }
                            return arguments[name];
                        });
                        try {
                            if (!txId) {
                                const res = await link.query(`SELECT * FROM ${sqlName}(${fillArgs})`, dynArgs);
                                return res;
                            }
                            if (!txMap.get(txId)) {
                                throw SqlSe.create(
                                    'transactionIdNotFound',
                                    {fn: jsName, argument: name, txId}
                                );
                            }
                            const res = await txMap.get(txId).query(`SELECT * FROM ${sqlName}(${fillArgs})`, dynArgs);
                            return res;
                        } catch (e) {
                            throw e;
                        }
                    }
                };
            }, {});
    };
    const methods = await build();
    return {
        methods,
        async stop() {
            return await link.end();
        },
        /**
         * Description
         * @returns {number}
         */
        async txBegin() {
            const id = ++txId;
            const client = await link.connect();
            await client.query('BEGIN');
            txMap.set(id, client);
            return id;
        },
        /**
         * Description
         * @param {number} id - transaction id
         * @param {'COMMIT'|'ROLLBACK'} action - do we commit or decline tx
         * @returns {void}
         */
        async txEnd(id, action) {
            const client = txMap.get(id);
            await client.query(action);
            client.release();
            txMap.delete(id);
        }
    };
};
