-- 재고 보정 (회의 2026-10-14 3번 · 회신 2026-10-23 결정-1 ③ · 결정-6)
-- 계근 차이·자연 감소·현금 출고처럼 정식 거래가 아닌 것을 적어 재고를 맞춘다.
-- 금액 칸은 두지 않는다 — 수량만 맞추고 손익은 건드리지 않는다.

CREATE TABLE IF NOT EXISTS "inventory_adjust" (
  "id"            TEXT NOT NULL,
  "project_id"    TEXT NOT NULL,
  "item_code"     TEXT NOT NULL,
  "adjust_date"   TIMESTAMP(3) NOT NULL,
  "kind"          TEXT NOT NULL,
  "direction"     TEXT NOT NULL,
  "weight"        DECIMAL(12,3) NOT NULL,
  "reason"        TEXT,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMP(3),
  CONSTRAINT "inventory_adjust_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "inventory_adjust" ADD CONSTRAINT "inventory_adjust_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_adjust" ADD CONSTRAINT "inventory_adjust_item_code_fkey"
    FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "inventory_adjust_project_id_idx" ON "inventory_adjust"("project_id");
