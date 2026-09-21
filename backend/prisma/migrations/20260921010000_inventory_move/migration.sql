-- 이동 현황 (리뷰회의 5-5)
--
-- 고객 메모: "이동 현황 — 항목 추가 요청.
--             예를 들어 원방<->투플러스, 원방<->크로스창고, 원방<->도림리 이런식으로 발생함."
--
-- 판 것도 처리 맡긴 것도 아니고, 우리 물건을 다른 자리로 옮긴 것이다.
-- 그래서 재고 총량은 그대로 두고 오간 기록만 남긴다 — 재고원장에는 넣지 않는다.
CREATE TABLE IF NOT EXISTS "inventory_move" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "move_date" TIMESTAMP(3) NOT NULL,
  "item_code" TEXT,
  "item_name" TEXT,
  "from_place" TEXT,
  "to_place" TEXT,
  "weight" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "vehicle_no" TEXT,
  "driver_name" TEXT,
  "memo" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "inventory_move_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "inventory_move" ADD CONSTRAINT "inventory_move_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inventory_move" ADD CONSTRAINT "inventory_move_item_code_fkey"
    FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "inventory_move_move_date_idx" ON "inventory_move"("move_date");
CREATE INDEX IF NOT EXISTS "inventory_move_project_id_idx" ON "inventory_move"("project_id");

-- 메모에 적힌 자리를 먼저 넣어 둔다. 목록에 없는 곳은 그대로 적으면 다음부터 목록에 나온다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order", "is_active", "created_at")
SELECT gen_random_uuid(), '이동장소', v."label", v."ord", true, now()
FROM (VALUES ('원방', 0), ('투플러스', 1), ('크로스창고', 2), ('도림리', 3)) AS v("label", "ord")
WHERE NOT EXISTS (SELECT 1 FROM "common_code" c WHERE c."group" = '이동장소' AND c."label" = v."label");
