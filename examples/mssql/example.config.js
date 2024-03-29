module.exports = {
    connect: {
        server: 'localhost',
        user: 'sa',
        password: '***',
        database: 'some-test-example',
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
        gluePrefix: '.',
        schemas: ['a', 'b'] // schemas allowed
    }
};