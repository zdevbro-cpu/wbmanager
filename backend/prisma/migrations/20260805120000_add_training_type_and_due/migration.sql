-- 교육 구분(의무/보수)과 다음 교육 예정일 — 만료 D-day 산출 기준
ALTER TABLE "employee_training" ADD COLUMN "training_type" TEXT;
ALTER TABLE "employee_training" ADD COLUMN "next_due_date" TIMESTAMP(3);
