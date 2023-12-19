const {join} = require('path');
const {readFile} = require('node:fs/promises');

module.exports = async() => ({
    types: (await readFile(join(__dirname, 'types.sql'))).toString('utf8'),
    methods: (await readFile(join(__dirname, 'methods.sql'))).toString('utf8')
});
