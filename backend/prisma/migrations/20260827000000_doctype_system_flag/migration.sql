-- 필수 분류 표시
-- 업무 화면에서 만들어진 문서(계약서·계근표·보고서 등)는 사람이 고르지 않고 정해진 분류로 들어간다.
-- 그 자리가 사라지면 연계가 조용히 끊기므로, 해당 분류와 그 윗단계를 시스템 분류로 표시해 삭제를 막는다.
-- 표시하지 않은 분류는 지금처럼 추가·삭제·이름 변경이 자유롭다.
ALTER TABLE "document_type" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- 문서가 자동으로 들어가는 소분류와, 그 소분류에 닿기 위한 대·중분류.
-- 코드는 기본 트리 생성 시점에 정해진 값이라 이름을 바꿔도 그대로다.
UPDATE "document_type"
SET "is_system" = true
WHERE "code" IN (
  -- 입출고
  'DOC-01',         'DOC-01-01',     'DOC-01-01-001',   -- 계근표(입고)
  'DOC-01-02',      'DOC-01-02-001',                    -- 계근표(출고)
  'DOC-01-03',      'DOC-01-03-001', 'DOC-01-03-002', 'DOC-01-03-003', -- 폐기물 전표·반출확인서·올바로 인계서
  'DOC-01-04',      'DOC-01-04-004', 'DOC-01-04-005',   -- 손익보고서 · 출고보고서
  -- 현장 관리
  'DOC-02',         'DOC-02-01',     'DOC-02-01-002',   -- 매입계약서
  -- 자산
  'DOC-03',         'DOC-03-01',     'DOC-03-01-001', 'DOC-03-01-002', -- 차량등록증 · 보험증권
  -- 임직원
  'DOC-04',         'DOC-04-01',     'DOC-04-01-001',   -- 근로계약서
  'DOC-04-03',      'DOC-04-03-002'                     -- 자격증
);

-- 매핑에 없는 곳에서 온 문서가 갈 자리. 없으면 자동 연계가 실패한다.
-- 대분류 '입출고'(DOC-01) 아래 중분류로 두고, 그 아래 소분류 하나를 둔다.
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), t.id, 2, 'DOC-01-09', '미분류', 99, 'UPLOAD', true, true, now()
FROM "document_type" t
WHERE t."code" = 'DOC-01'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = 'DOC-01-09');

INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), t.id, 3, 'DOC-01-09-001', '분류 대기', 0, 'UPLOAD', true, true, now()
FROM "document_type" t
WHERE t."code" = 'DOC-01-09'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = 'DOC-01-09-001');
