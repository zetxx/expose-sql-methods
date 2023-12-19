CREATE TABLE "exsschema"."tx" (
    tag serial PRIMARY KEY,
    device VARCHAR (100) NOT NULL,
    created BIGINT DEFAULT extract(epoch from now())
);
---------------------------------------------------------------
INSERT INTO "exsschema".tx (device,created) VALUES
	 ('34987a479f90',1702857600),
	 ('ec62608a3368',1702857600),
	 ('34987a479f90',1702894599),
	 ('ec62608a3368',1702894609),
	 ('34987a479f90',1702894784),
	 ('ec62608a3368',1702894804),
	 ('34987a479f90',1702894968),
	 ('ec62608a3368',1702894988),
	 ('34987a479f90',1702895168),
	 ('ec62608a3368',1702895182);
---------------------------------------------------------------
CREATE FUNCTION "exsschema"."fnLastTx"("pDevice" VARCHAR (100))
    RETURNS table (tag integer, created BIGINT)
AS
$$
    SELECT tag, created FROM "exsschema"."tx" WHERE tag = (SELECT MAX(tag) AS tag FROM "exsschema"."tx" WHERE device = "pDevice");
$$
LANGUAGE sql;
---------------------------------------------------------------
CREATE FUNCTION "fnNewTx"(pDevice VARCHAR (100), pCreated BIGINT)
    RETURNS table (tag integer, created BIGINT)
AS
$$
    SELECT 1 tag, 2 created RETURNING tag, created;
$$
LANGUAGE sql;