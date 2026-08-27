-- 등록자 기록
-- 모바일에서 "오늘 내가 올린 건"을 보여 주려면 누가 올렸는지 알아야 한다.
-- 감사 기록에는 거래를 가리키는 참조가 없어(문서만 남긴다) 거래 표에 직접 남긴다.
ALTER TABLE "inbound" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
ALTER TABLE "waste_inbound" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
ALTER TABLE "outbound_sale" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
