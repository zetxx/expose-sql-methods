(async() => {
    try {
        const methods = await require('../../lib/postgres')(
            require('./config')
        );
        if (methods && methods['exsschema/fnLastTx'])
            await methods['exsschema/fnLastTx']({pDevice: '34987a479f90'});
    } catch (e) {
        console.error(e);
    }
})();