const sql = require('mssql');

const query = (async() => {
    const {
        server,
        user,
        password,
        pool,
        database,
        options
    } = require('../mssql.config.js');
    const cPool = await sql.connect({
        server,
        user,
        password,
        pool,
        database,
        options
    });
    return async(q) => {
        try {
            return await cPool.request().query(q);
        } catch (e) {
            console.warn(q);
            console.error(e);
            throw e;
        }
    };
});
