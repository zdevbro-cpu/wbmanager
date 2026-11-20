-- 입고에 C/T 와 단가 칸 (요청 2026-11-13)
--
-- 설비·펌프처럼 한 덩어리로 들어올 때가 있어 입고 시점에 단가를 적어야 한다.
-- C/T 가 무엇을 적는 칸인지는 아직 확인 전이라 글자로 받아 둔다.

ALTER TABLE "inbound" ADD COLUMN IF NOT EXISTS "ct" TEXT;
ALTER TABLE "inbound" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(14,2);
