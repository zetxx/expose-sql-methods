const read = require('util').promisify(require('fs').readFile);
module.exports = {
    internalMethod: read([__dirname, 'internalMethod.sql'].join('/')),
    tableTypes: read([__dirname, 'tableTypes.sql'].join('/'))
};
