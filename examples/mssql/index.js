(async() => {
    const methods = await require('../../lib/mssql')(
        require('../mssql.config.js')
    );
    methods['abc']({arg1: 123});
})();