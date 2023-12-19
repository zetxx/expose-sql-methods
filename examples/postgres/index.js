(async() => {
    try {
        const methods = await require('../../lib/postgres')(
            require('./config')
        );
        if (methods && methods['exsschema/fnLastTx']){
            const res = await methods['exsschema/fnLastTx']({pDevice: '34987a479f90'});
            console.table(res.rows);
        }
    } catch (e) {
        console.error(e);
    }
})();