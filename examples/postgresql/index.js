(async() => {
    const methods = await require('../../lib/postgresql')(
        require('./config')
    );
    try {
        await methods['some-test-example/exsschema/fnLastTx"']({ParLessonType: [{LessonId: 100, LessonName: 'example lesson'}]});
    } catch (e) {
        console.error(e);
    }
})();