const driver = require('postgres');
const {SError, WError} = require('error');
const SqlSe = (() => (class Sql extends SError {}))();
const SqlWe = (() => (class Sql extends WError {}))();


const predefinedSql = require('./sqls/index.js');

const conn = (() => {
    let connection;
    return async(config) => {
        if (connection === undefined) {
            connection = await driver(config);
            return connection;
        }
        return connection;
    };
})();


const Link = async(config) => {
    const sql = await conn(config);
    return {
        sql
    };
};


module.exports = async(config) => {
    const {link: {gluePrefix = '.', schemas} = {}} = config;
    const link = await Link(config.connect);

    const predefinedQuery = async(key) => {
        if (!key) {
            throw SqlSe.create('noSuchSqlHelperFile');
        }
        try {
            const q = predefinedSql[key];
            const r = await q(link);
            return r;
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
                cache = await predefinedQuery('methods');
            }
            return cache;
        };
    })();
    // https://www.postgresql.org/docs/current/catalog-pg-proc.html
    const buildArgs = (argnames, argmodes) => {
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
        return (await predefinedQuery('methods'))
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
                const sqlName = [`${schema}`, `${name}`].join('.');
                const args = buildArgs(argnames, argmodes);
                return {
                    ...methods,
                    [jsName]: async(arguments) => {
                        const dynArgs = args.input.map(({name}) => {
                            if (!arguments[name]) {
                                throw SqlSe.create(
                                    'argumentNotFound',
                                    {fn: jsName, argument: name}
                                );
                            }
                            return `'${arguments[name]}'`;
                        });
                        // const res = await link.sql`select * from ${link.sql(sqlName)}('abc')`
                        const res = await link.sql`select * from ${link.sql(sqlName)}(${link.sql(arguments)})`
                        return await res;
                    }
                };
            }, {});
    };
    return await build();
};
