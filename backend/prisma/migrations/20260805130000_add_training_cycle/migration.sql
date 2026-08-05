-- 교육 주기(개월) — 이수일 + 주기로 다음 교육 예정일을 산출한다.
ALTER TABLE "employee_training" ADD COLUMN "cycle_months" INTEGER;
