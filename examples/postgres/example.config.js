module.exports = {
    connect: {
        server: 'localhost',
        user: 'sa',
        password: '***',
        database: 'some-test-example'
    },
    link: {
        gluePrefix: '.',
        schemas: ['public'] // schemas allowed
    }
};