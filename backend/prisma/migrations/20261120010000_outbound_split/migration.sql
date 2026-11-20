-- 계량증명서 한 장을 여러 현장·품목으로 나눠 적는다 (요청 2026-11-13)
--
-- 한 번 계근한 차에 여러 현장 물건이 섞여 실리거나, 나간 제품에서 다른 제품이
-- 검수되어 중량을 갈라야 할 때가 있다. 계량증명서는 한 건으로 두고
-- 그 아래에 「어느 현장·어느 품목에 몇 kg」을 줄로 남긴다.
--
-- 줄이 하나도 없으면 지금까지처럼 출고 한 건이 통째로 한 현장·한 품목이다.

CREATE TABLE IF NOT EXISTS "outbound_split" (
  "id"                TEXT NOT NULL,
  "outbound_sale_id"  TEXT NOT NULL,
  "project_id"        TEXT NOT NULL,
  "item_code"         TEXT NOT NULL,
  "weight"            DECIMAL(12,3) NOT NULL,
  "amount"            DECIMAL(14,2),
  "memo"              TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbound_split_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "outbound_split" ADD CONSTRAINT "outbound_split_outbound_sale_id_fkey"
    FOREIGN KEY ("outbound_sale_id") REFERENCES "outbound_sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "outbound_split" ADD CONSTRAINT "outbound_split_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "outbound_split" ADD CONSTRAINT "outbound_split_item_code_fkey"
    FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "outbound_split_outbound_sale_id_idx" ON "outbound_split"("outbound_sale_id");
