-- 운반비에 제품과 단가
-- 무엇을 얼마에 실어 날랐는지가 남지 않아, 운반비가 어떻게 나온 값인지 뒤에서 확인할 수 없었다.
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "item_code" TEXT;
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
-- 원/kg. 중량 × 단가로 공급가액을 낼 때 쓴다.
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(14,2);
