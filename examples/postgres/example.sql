CREATE TABLE "some-test-example"."exsschema"."tx" (
    tag serial PRIMARY KEY,
    device VARCHAR (100) NOT NULL,
    created BIGINT DEFAULT extract(epoch from now())
);
---------------------------------------------------------------
CREATE FUNCTION "some-test-example"."exsschema"."fnLastTx"(pDevice VARCHAR (100))
    RETURNS table (tag integer, created BIGINT)
AS
$$
    SELECT tag, created FROM "some-test-example"."exsschema"."tx" WHERE tag = (SELECT MAX(tag) AS tag FROM "some-test-example"."exsschema"."tx" WHERE device = pDevice);
$$
LANGUAGE sql;
---------------------------------------------------------------
CREATE FUNCTION "some-test-example"."exsschema"."fnNewTx"(pDevice VARCHAR (100), pCreated BIGINT)
    RETURNS table (tag integer, created BIGINT)
AS
$$
    INSERT INTO "some-test-example"."exsschema"."tx" (device, created) VALUES (pDevice, pCreated) RETURNING tag, created;
$$
LANGUAGE sql;