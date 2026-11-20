-- 거래에 적는 운반비의 세액 칸 (요청 2026-11-13)
--
-- 지금까지는 거래 화면에서 적은 운반비가 공급가액으로만 들어가고
-- 세액을 적을 자리가 없었다. 세금계산서와 맞추려면 둘을 나눠 적어야 한다.

ALTER TABLE "inbound"         ADD COLUMN IF NOT EXISTS "transport_tax" DECIMAL(14,2);
ALTER TABLE "waste_inbound"   ADD COLUMN IF NOT EXISTS "transport_tax" DECIMAL(14,2);
ALTER TABLE "inventory_move"  ADD COLUMN IF NOT EXISTS "transport_tax" DECIMAL(14,2);
ALTER TABLE "outbound_sale"   ADD COLUMN IF NOT EXISTS "transport_tax" DECIMAL(14,2);
ALTER TABLE "waste_outbound"  ADD COLUMN IF NOT EXISTS "transport_tax" DECIMAL(14,2);
