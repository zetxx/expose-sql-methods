(async() => {
    const methods = await require('../../lib/mssql')(
        require('../mssql.config.js')
    );
    try {
        await methods['dbo.Usp_InsertLesson']({ParLessonType: [{LessonId: 100, LessonName: 'example lesson'}]});
    } catch (e) {
        console.error(e);
    }
})();