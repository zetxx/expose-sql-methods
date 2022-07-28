module.exports = {
    server: 'localhost',
    user: 'sa',
    password: '*******',
    database: 'migration-test',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true, // for azure
        trustServerCertificate: true // change to true for local dev / self-signed certs
    }
};