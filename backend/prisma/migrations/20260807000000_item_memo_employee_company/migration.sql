-- 품목 마스터 비고 — 등록 화면 간소화에 맞춰 자유 입력 항목을 둔다.
ALTER TABLE "item_master" ADD COLUMN "memo" TEXT;

-- 임직원 소속 회사 — 원방 현장에 있으나 소속이 다른 인원이 있다.
ALTER TABLE "employee" ADD COLUMN "company_name" TEXT;
