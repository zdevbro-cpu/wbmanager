-- 자산 서류 분류 보강 (리뷰회의 5-9)
--
-- 고객 메모: "차량 > 법인차량 > 차량번호에 따라 차량등록증, 보험증권, 제원표가 들어가도록"
--
-- 지금 차량 아래에는 등록증·보험증권·정비이력·유류정산서뿐이라
-- 검사증과 제원표를 올리면 갈 곳이 없어 「미분류」로 떨어졌다.
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), p."id", 3, v."code", v."name", v."ord", 'UPLOAD', true, true, now()
FROM "document_type" p
CROSS JOIN (VALUES
  ('DOC-03-01-005', '검사증', 4),
  ('DOC-03-01-006', '제원표', 5)
) AS v("code", "name", "ord")
WHERE p."code" = 'DOC-03-01'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = v."code");

-- 자동 편입이 가리키는 자리는 지워지면 안 된다 — 지워지면 그 뒤로 올린 서류가 조용히 미분류로 간다.
UPDATE "document_type" SET "is_system" = true WHERE "code" IN ('DOC-03-01-005', 'DOC-03-01-006');
