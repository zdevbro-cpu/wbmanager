-- 근태·공수 집계
--
-- 공수표는 지금까지 "한 사람의 하루"를 이름 문자열로만 적었다. 그래서 월 단위로
-- 누가 며칠 나왔는지 묶을 수 없었고, 정규직의 출근·연차 같은 근태는 담을 자리가 없었다.
-- 급여를 계산하지는 않는다 — 근태와 공수를 모아 월로 집계하고 출력하는 데까지다.

-- 1) 한 줄이 담는 것을 늘린다. 기존 열과 자료는 그대로 둔다.
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;
-- 근태 — 출근/반차/특근/연차/병가/결근/휴무. 아래 공통코드에 넣는 이름을 그대로 담는다.
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "attend_code" TEXT;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_in_at" TIMESTAMP(3);
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_out_at" TIMESTAMP(3);
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_in_lat" DOUBLE PRECISION;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_in_lng" DOUBLE PRECISION;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_out_lat" DOUBLE PRECISION;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_out_lng" DOUBLE PRECISION;
-- 현장 기준점에서 얼마나 떨어져 찍었는지(m). 화면에서 "현장 밖"을 가려내는 값이다.
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "check_in_distance" INTEGER;
-- 본인 확인 결과 — match 일치 / unsure 확인필요 / mismatch 불일치
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "face_verdict" TEXT;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "face_note" TEXT;
-- 월 마감 단위. 'YYYY-MM'
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "settle_month" TEXT;
-- 현장에서 올라온 것은 사무실 확인 전까지 임시저장이다(계량증명서와 같은 방식).
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "labor" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- 지난 자료도 월로 묶여야 한다. 작업일에서 만들어 채운다.
UPDATE "labor" SET "settle_month" = to_char("work_date", 'YYYY-MM') WHERE "settle_month" IS NULL;

DO $$ BEGIN
  ALTER TABLE "labor" ADD CONSTRAINT "labor_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "labor_settle_month_idx" ON "labor"("settle_month");
CREATE INDEX IF NOT EXISTS "labor_employee_id_work_date_idx" ON "labor"("employee_id", "work_date");

-- 2) 셀카는 지금 쓰는 첨부 구조에 그대로 담는다. 파일은 드라이브에 있고 여기에는 연결만 남는다.
ALTER TABLE "attachment" ADD COLUMN IF NOT EXISTS "labor_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "attachment" ADD CONSTRAINT "attachment_labor_id_fkey"
    FOREIGN KEY ("labor_id") REFERENCES "labor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) 월 마감. 마감한 달은 잠기고, 다시 여는 것은 관리자만 한다.
--    photo_purged_at — 마감 뒤 셀카를 지운 시각. 얼굴 사진은 마감이 끝나면 남길 이유가 없다.
CREATE TABLE IF NOT EXISTS "labor_settlement" (
  "id" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "closed_by_id" TEXT,
  "closed_at" TIMESTAMP(3),
  "photo_purged_at" TIMESTAMP(3),
  "memo" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "labor_settlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "labor_settlement_month_key" ON "labor_settlement"("month");

-- 4) 본인 확인의 기준이 되는 사진과, 얼굴 대조에 대한 동의.
--    동의는 처음 한 번만 받는다. 받은 시각을 남겨 두 번 묻지 않는다.
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "photo_drive_id" TEXT;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "photo_link" TEXT;
ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "face_consent_at" TIMESTAMP(3);

-- 5) 현장 기준점. 화면에 입력칸을 두지 않는다 —
--    그 현장에서 처음 찍힌 출근 위치를 기준으로 삼고, 그 뒤로는 반경 안인지만 본다.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "site_lat" DOUBLE PRECISION;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "site_lng" DOUBLE PRECISION;
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "geo_radius" INTEGER NOT NULL DEFAULT 100;

-- 6) 근태코드는 공통코드로 둔다. 회사마다 부르는 이름이 다르고, 엑셀로 늘릴 수 있어야 한다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order", "is_active", "created_at")
SELECT gen_random_uuid(), '근태코드', v."label", v."ord", true, now()
FROM (VALUES
  ('출근', 0), ('반차', 1), ('특근', 2), ('연차', 3), ('병가', 4), ('결근', 5), ('휴무', 6)
) AS v("label", "ord")
WHERE NOT EXISTS (SELECT 1 FROM "common_code" c WHERE c."group" = '근태코드' AND c."label" = v."label");
