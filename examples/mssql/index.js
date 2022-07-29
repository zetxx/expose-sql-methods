(async() => {
    await require('../../lib/mssql')(
        require('../mssql.config.js')
    );
})();