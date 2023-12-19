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
        request: async(q) => {
            try {
                return await sql(['select 123']);
            } catch (e) {
                console.warn(q);
                console.error(e);
                throw e;
            }
        },
        sql
    };
};


module.exports = async(config) => {
    const {gluePrefix = '.'} = config;
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

    const build = async() => {
        const allTypes = await types();
        (await predefinedQuery('methods'))
            .map((method) => {
                console.log(method);
            });
    };
    return await build();
};
