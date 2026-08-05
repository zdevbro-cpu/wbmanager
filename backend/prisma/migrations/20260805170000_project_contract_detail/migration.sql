-- 프로젝트 계약 정보 확장 — 발주처·시공사·현장 분리, 계약금액·계약중량·정산 항목
ALTER TABLE "project" ADD COLUMN "project_code" TEXT;
ALTER TABLE "project" ADD COLUMN "round_no" TEXT;
ALTER TABLE "project" ADD COLUMN "orderer_id" TEXT;
ALTER TABLE "project" ADD COLUMN "contractor_id" TEXT;
ALTER TABLE "project" ADD COLUMN "site_name" TEXT;
ALTER TABLE "project" ADD COLUMN "region" TEXT;
ALTER TABLE "project" ADD COLUMN "contract_amount" DECIMAL(14,2);
ALTER TABLE "project" ADD COLUMN "contract_weight" DECIMAL(14,3);
ALTER TABLE "project" ADD COLUMN "vat_included" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "project" ADD COLUMN "deposit" DECIMAL(14,2);
ALTER TABLE "project" ADD COLUMN "advance_payment" DECIMAL(14,2);
ALTER TABLE "project" ADD COLUMN "settlement_cycle" TEXT;
ALTER TABLE "project" ADD COLUMN "manager_emp_id" TEXT;
ALTER TABLE "project" ADD COLUMN "discharger_name" TEXT;
ALTER TABLE "project" ADD COLUMN "memo" TEXT;

CREATE UNIQUE INDEX "project_project_code_key" ON "project"("project_code");

ALTER TABLE "project" ADD CONSTRAINT "project_orderer_id_fkey"
  FOREIGN KEY ("orderer_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project" ADD CONSTRAINT "project_contractor_id_fkey"
  FOREIGN KEY ("contractor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project" ADD CONSTRAINT "project_manager_emp_id_fkey"
  FOREIGN KEY ("manager_emp_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 프로젝트 소급 채번 (P-{등록연도}-{일련번호})
WITH numbered AS (
  SELECT id,
         to_char("created_at", 'YYYY') AS yr,
         row_number() OVER (PARTITION BY to_char("created_at", 'YYYY') ORDER BY "created_at") AS seq
  FROM "project"
)
UPDATE "project" p
SET "project_code" = 'P-' || n.yr || '-' || lpad(n.seq::text, 3, '0')
FROM numbered n
WHERE p.id = n.id;

-- 원본 프로젝트명은 `발주처_시공사_현장` 형태다(예: 포스코_KM_안산).
-- 세 토막인 건만 현장명을 분리하고, 원본 문자열은 round_name에 그대로 둔다.
UPDATE "project"
SET "site_name" = split_part("round_name", '_', 3)
WHERE "round_name" LIKE '%\_%\_%' AND split_part("round_name", '_', 3) <> '';

-- 발주처·시공사는 거래처 마스터에 같은 이름이 있을 때만 연결한다(임의 생성하지 않음).
UPDATE "project" p
SET "orderer_id" = v.id
FROM "vendor" v
WHERE p."round_name" LIKE '%\_%'
  AND split_part(p."round_name", '_', 1) = v."name"
  AND p."orderer_id" IS NULL;

UPDATE "project" p
SET "contractor_id" = v.id
FROM "vendor" v
WHERE p."round_name" LIKE '%\_%\_%'
  AND split_part(p."round_name", '_', 2) = v."name"
  AND p."contractor_id" IS NULL;

-- 정산주기도 공통코드에서 고른다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order")
VALUES
  (gen_random_uuid(), '정산주기', '월별', 0),
  (gen_random_uuid(), '정산주기', '차수완료', 1),
  (gen_random_uuid(), '정산주기', '수시', 2)
ON CONFLICT ("group", "label") DO NOTHING;
