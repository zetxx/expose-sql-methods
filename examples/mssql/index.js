const sql = require('mssql');
const lib = require('../../lib/mssql');

const init = (async() => {
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
    return cPool.request();
});
