CREATE TYPE LessonType AS TABLE (LessonId INT, LessonName VARCHAR(100))

CREATE TABLE Lesson ( 
    Id    INT PRIMARY KEY, 
    LName VARCHAR(50)
)
-------------------------
CREATE PROCEDURE Usp_InsertLesson
    @ParLessonType LessonType READONLY,
    @ParLessonType2 LessonType READONLY
AS
    INSERT INTO Lesson
        SELECT * FROM @ParLessonType;

CREATE PROCEDURE Usp_InsertLesson2
    @ParLessonType LessonType READONLY,
    @ParLessonType2 LessonType READONLY
AS
    INSERT INTO Lesson
        SELECT * FROM @ParLessonType
-------------------------
DECLARE @VarLessonType AS LessonType
 
INSERT INTO @VarLessonType VALUES ( 1, 'Math')
INSERT INTO @VarLessonType VALUES ( 2, 'Science')
INSERT INTO @VarLessonType VALUES ( 3, 'Geometry')
    
    
EXECUTE Usp_InsertLesson @VarLessonType
-------------------------
-------------------------
-------------------------