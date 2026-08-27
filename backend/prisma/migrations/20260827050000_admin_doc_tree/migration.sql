-- 일반행정 문서 분류
-- 계약·인허가·세무·공문처럼 현장이 아니라 사무에서 오가는 서류는 지금 트리에 자리가 없었다.
-- 대분류 하나를 만들고 그 아래 자주 쓰는 갈래를 미리 깔아 둔다.
-- 잠그지 않는다 — 회사마다 쓰는 서류가 달라 직접 늘리고 줄일 수 있어야 한다.
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), NULL, 1, 'DOC-05', '일반행정', 5, 'UPLOAD', false, true, now()
WHERE NOT EXISTS (SELECT 1 FROM "document_type" WHERE "code" = 'DOC-05');

-- 중분류
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), p."id", 2, v."code", v."name", v."ord", 'UPLOAD', false, true, now()
FROM "document_type" p
CROSS JOIN (VALUES
  ('DOC-05-01', '계약·협약', 0),
  ('DOC-05-02', '인허가·신고', 1),
  ('DOC-05-03', '세무·회계', 2),
  ('DOC-05-04', '공문·내부문서', 3)
) AS v("code", "name", "ord")
WHERE p."code" = 'DOC-05'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = v."code");

-- 소분류
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), p."id", 3, v."code", v."name", v."ord", 'UPLOAD', false, true, now()
FROM "document_type" p
CROSS JOIN (VALUES
  ('DOC-05-01', 'DOC-05-01-001', '표준계약서', 0),
  ('DOC-05-01', 'DOC-05-01-002', '업무협약서(MOU)', 1),
  ('DOC-05-01', 'DOC-05-01-003', '비밀유지약정서(NDA)', 2),
  ('DOC-05-01', 'DOC-05-01-004', '용역·도급계약서', 3),
  ('DOC-05-01', 'DOC-05-01-005', '임대차계약서', 4),
  ('DOC-05-02', 'DOC-05-02-001', '사업자등록증', 0),
  ('DOC-05-02', 'DOC-05-02-002', '법인등기부등본', 1),
  ('DOC-05-02', 'DOC-05-02-003', '인허가증', 2),
  ('DOC-05-02', 'DOC-05-02-004', '신고필증', 3),
  ('DOC-05-03', 'DOC-05-03-001', '세금계산서', 0),
  ('DOC-05-03', 'DOC-05-03-002', '지출결의서', 1),
  ('DOC-05-03', 'DOC-05-03-003', '통장 사본', 2),
  ('DOC-05-03', 'DOC-05-03-004', '납세증명서', 3),
  ('DOC-05-04', 'DOC-05-04-001', '발송 공문', 0),
  ('DOC-05-04', 'DOC-05-04-002', '접수 공문', 1),
  ('DOC-05-04', 'DOC-05-04-003', '회의록', 2),
  ('DOC-05-04', 'DOC-05-04-004', '사내규정', 3)
) AS v("parent", "code", "name", "ord")
WHERE p."code" = v."parent"
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = v."code");

-- 자동 편입이 가리키는데 아직 잠기지 않았던 분류를 마저 잠근다.
-- 지워지면 그 뒤로 올린 서류가 조용히 「미분류」로 떨어진다.
UPDATE "document_type" SET "is_system" = true
WHERE "code" IN (
  'DOC-01-01-003',  -- 인수증
  'DOC-01-02-002',  -- 출고전표
  'DOC-03-01-003',  -- 정비이력
  'DOC-03-02',      -- 장비
  'DOC-03-02-002'   -- 임대차계약서(자산 계약서가 들어가는 자리)
);
