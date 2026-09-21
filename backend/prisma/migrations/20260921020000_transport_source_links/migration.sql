-- 운반비를 거래 등록에서 바로 적는다 (리뷰회의 5-6)
--
-- 고객 메모: "운반비 쓰는 란 간단히 / 입출고 쓸 때 운반비 부분 추가"
--
-- 지금은 폐기물 반출에 적은 운반비만 운반비 표에 자동으로 들어간다(waste_outbound_id).
-- 입고·출고·폐기물 수집·이동에서 적은 운반비도 같은 방식으로 잇는다.
-- 손익의 운반비는 이 표를 합산하므로, 표는 그대로 두고 적는 자리만 늘린다.
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "inbound_id" TEXT;
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "outbound_sale_id" TEXT;
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "waste_inbound_id" TEXT;
ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "move_id" TEXT;

-- 한 거래에 운반비 한 줄. 거래를 고치면 그 줄이 고쳐지고, 지우면 함께 지워진다.
CREATE UNIQUE INDEX IF NOT EXISTS "transport_inbound_id_key" ON "transport"("inbound_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_outbound_sale_id_key" ON "transport"("outbound_sale_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_waste_inbound_id_key" ON "transport"("waste_inbound_id");
CREATE UNIQUE INDEX IF NOT EXISTS "transport_move_id_key" ON "transport"("move_id");

DO $$ BEGIN
  ALTER TABLE "transport" ADD CONSTRAINT "transport_inbound_id_fkey"
    FOREIGN KEY ("inbound_id") REFERENCES "inbound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transport" ADD CONSTRAINT "transport_outbound_sale_id_fkey"
    FOREIGN KEY ("outbound_sale_id") REFERENCES "outbound_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transport" ADD CONSTRAINT "transport_waste_inbound_id_fkey"
    FOREIGN KEY ("waste_inbound_id") REFERENCES "waste_inbound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "transport" ADD CONSTRAINT "transport_move_id_fkey"
    FOREIGN KEY ("move_id") REFERENCES "inventory_move"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 이동에도 운반비를 적는다 — 자리 간 운반이 곧 운반비다.
ALTER TABLE "inventory_move" ADD COLUMN IF NOT EXISTS "transport_cost" DECIMAL(14,2);

-- 적은 운반비는 거래에도 남긴다 — 화면에서 다시 열었을 때 그대로 보여야 한다.
ALTER TABLE "inbound" ADD COLUMN IF NOT EXISTS "transport_cost" DECIMAL(14,2);
ALTER TABLE "outbound_sale" ADD COLUMN IF NOT EXISTS "transport_cost" DECIMAL(14,2);
ALTER TABLE "waste_inbound" ADD COLUMN IF NOT EXISTS "transport_cost" DECIMAL(14,2);
