module.exports = {
    connect: {
        server: 'localhost',
        user: 'sa',
        password: '***',
        database: 'mfactor',
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 60000
        },
        options: {
            encrypt: true, // for azure
            trustServerCertificate: true // change to true for local dev / self-signed certs
        }
    },
    link: {
        SP: {
            schemas: ['a', 'b'] // schemas allowed
        }
    }
};