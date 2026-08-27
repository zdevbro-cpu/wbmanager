-- 계근표 보존연한
-- 계근표는 세금계산서의 근거가 되는 증빙이고 세무조사·감사 때 실제로 꺼내 쓴다.
-- 국세기본법상 장부·증빙 보존기간이 5년이므로 60개월을 건다.
-- 기간이 다르게 정해지면 문서 분류 화면에서 값만 바꾸면 된다.
UPDATE "document_type"
SET "retention_months" = 60
WHERE "code" IN (
  'DOC-01-01-001',  -- 계근표(입고)
  'DOC-01-02-001',  -- 계근표(출고)
  'DOC-01-03-001',  -- 폐기물 입고전표
  'DOC-01-03-002',  -- 반출확인서
  'DOC-01-03-003'   -- 올바로 인계서
) AND "retention_months" IS NULL;

-- 이미 편입된 문서에도 만료일을 채운다. 등록일 기준 5년이다.
UPDATE "document" d
SET "retention_until" = (d."created_at" + INTERVAL '60 months')::date
FROM "document_type" t
WHERE d."type_id" = t."id"
  AND t."retention_months" = 60
  AND d."retention_until" IS NULL
  AND d."deleted_at" IS NULL;
