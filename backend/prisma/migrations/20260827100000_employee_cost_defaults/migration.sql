-- 정규직 외 인원의 품값 기준 — 사용 요청을 승인하는 자리에서 한 번 적어 두고
-- 공수표에서는 날짜와 근태만 고르면 되도록 임직원에 붙여 둔다.
ALTER TABLE "employee" ADD COLUMN "unit_cost" DECIMAL(14,2);
ALTER TABLE "employee" ADD COLUMN "meal_cost" DECIMAL(14,2);
ALTER TABLE "employee" ADD COLUMN "etc_cost" DECIMAL(14,2);
