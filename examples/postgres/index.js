(async() => {
    try {
        const methods = await require('../../lib/postgres')(
            require('./config')
        );
        if (methods['some-test-example/exsschema/fnLastTx"'])
            await methods['some-test-example/exsschema/fnLastTx"']({ParLessonType: [{LessonId: 100, LessonName: 'example lesson'}]});
    } catch (e) {
        console.error(e);
    }
})();