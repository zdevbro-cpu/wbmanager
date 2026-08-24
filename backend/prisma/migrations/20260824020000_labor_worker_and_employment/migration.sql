-- 공수표 — 한 줄을 '한 사람의 하루'로 쓰기 위해 작업자·구분·단가를 둔다.
ALTER TABLE "labor" ADD COLUMN "worker_name" TEXT;
ALTER TABLE "labor" ADD COLUMN "worker_type" TEXT;
ALTER TABLE "labor" ADD COLUMN "unit_cost" DECIMAL(14,2);

-- 임직원 고용 구분 — 기존 인원은 정규직으로 둔다.
ALTER TABLE "employee" ADD COLUMN "employment_type" TEXT DEFAULT '정규직';
