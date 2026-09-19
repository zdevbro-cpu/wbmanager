-- 공수 수정 이력 — 누가 언제 왜 고쳤는지, 고치기 전 값과 고친 값.
-- 원래 값은 첫 이력의 before 에 그대로 남는다(리뷰회의 2-4 · 2-5).
CREATE TABLE "labor_edit" (
    "id" TEXT NOT NULL,
    "labor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "edited_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_edit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "labor_edit_labor_id_idx" ON "labor_edit"("labor_id");

ALTER TABLE "labor_edit" ADD CONSTRAINT "labor_edit_labor_id_fkey"
  FOREIGN KEY ("labor_id") REFERENCES "labor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 사번 형식 변경 — EMP-연도-일련번호 → 회사약자-등록연월-일련번호(리뷰회의 2-6).
-- 지금 자료는 샘플이라 기존 사번도 새 형식으로 바꾼다. 회사약자는 소속 회사로 정한다(크로스 CR, 그 밖 WB).
-- 등록연월은 한국 시각 기준 등록한 달, 일련번호는 회사·달마다 등록 순서대로 001부터.
-- 새 사번은 옛 사번(EMP-)과 모양이 달라 바꾸는 도중에 겹치지 않는다.
WITH ranked AS (
  SELECT
    "id",
    CASE WHEN "company_name" ILIKE '%크로스%' OR "company_name" ILIKE '%cross%' THEN 'CR' ELSE 'WB' END AS co,
    to_char("created_at" + INTERVAL '9 hours', 'YYYYMM') AS ym,
    "created_at"
  FROM "employee"
  WHERE "emp_code" IS NOT NULL
),
numbered AS (
  SELECT
    "id",
    co || '-' || ym || '-' || lpad(row_number() OVER (PARTITION BY co, ym ORDER BY "created_at", "id")::text, 3, '0') AS code
  FROM ranked
)
UPDATE "employee" e
SET "emp_code" = n.code
FROM numbered n
WHERE e."id" = n."id";

-- 공수표 근태 목록에 조퇴 추가(리뷰회의 2-3). 이미 있으면 넣지 않는다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order", "is_active", "created_at")
SELECT gen_random_uuid(), '근태코드', '조퇴',
       (SELECT COALESCE(MAX("sort_order"), 0) + 1 FROM "common_code" WHERE "group" = '근태코드'),
       true, now()
WHERE NOT EXISTS (SELECT 1 FROM "common_code" c WHERE c."group" = '근태코드' AND c."label" = '조퇴');
