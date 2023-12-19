const {join} = require('path');
module.exports = {
    types: async(link) => link.sql.file(join(__dirname, 'types.sql')),
    methods: async(link) => link.sql.file(join(__dirname, 'methods.sql'))
};
