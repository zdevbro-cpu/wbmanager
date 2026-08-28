-- 이미 있던 현장에 번호를 채운다. 만들어진 차례대로 1번부터 붙인다.
-- 이미 번호를 받은 현장이 있으면 그 뒤부터 이어 붙여, 쓰던 번호가 바뀌지 않게 한다.
WITH base AS (
  SELECT COALESCE(MAX("site_no"), 0) AS m FROM "project"
),
numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at") AS rn
  FROM "project"
  WHERE "site_no" IS NULL
)
UPDATE "project" p
SET "site_no" = n.rn + (SELECT m FROM base)
FROM numbered n
WHERE p."id" = n."id";
