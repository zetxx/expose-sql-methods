const driver = require('postgresql');
const {SError, WError} = require('error');
const SqlSe = (() => (class Sql extends SError {}))();
const SqlWe = (() => (class Sql extends WError {}))();


const predefinedSql = require('./sqls/index.js');

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

    return {};
};