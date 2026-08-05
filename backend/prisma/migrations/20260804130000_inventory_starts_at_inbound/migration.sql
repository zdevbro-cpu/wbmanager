-- AlterTable
ALTER TABLE "sorting" ADD COLUMN     "source_item_code" TEXT;

-- AddForeignKey
ALTER TABLE "sorting" ADD CONSTRAINT "sorting_source_item_code_fkey" FOREIGN KEY ("source_item_code") REFERENCES "item_master"("item_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 재고 정의를 원본 갑지에 맞춘다: 재고 = 입고 - 출고
-- (근거: 원방_거래처별 스크랩 출고 현황_Sample.xlsx 갑지 시트의 입고량/출고량/재고량)
--
-- 기존 로직은 재고 IN을 선별에서만 계상해 입고가 재고에 잡히지 않았다. 아래에서
--   (1) 미분류 품목을 만들고
--   (2) 기존 입고/폐기물입고에 누락된 IN을 소급 계상하고
--   (3) 기존 선별에 상계 OUT을 넣어 재분류(순증 0)로 되돌린다.
-- 모두 NOT EXISTS 가드가 있어 재실행해도 중복되지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) 미분류 품목
INSERT INTO "item_master" ("id", "item_code", "category", "item_name", "is_temporary", "created_at")
SELECT gen_random_uuid(), 'UNCLASSIFIED', '미분류', '미분류', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "item_master" WHERE "item_code" = 'UNCLASSIFIED');

-- (2-a) 기존 입고 → 재고 IN 소급 계상 (재고반영중량 우선, 없으면 입고량)
INSERT INTO "inventory_ledger" ("id", "project_id", "item_code", "direction", "weight", "ledger_date", "ref_type", "ref_id", "created_at")
SELECT gen_random_uuid(), i."project_id", COALESCE(i."item_code", 'UNCLASSIFIED'), 'IN',
       COALESCE(i."stock_weight", i."net_weight"), i."inbound_date", 'inbound', i."id", CURRENT_TIMESTAMP
  FROM "inbound" i
 WHERE NOT EXISTS (
         SELECT 1 FROM "inventory_ledger" l
          WHERE l."ref_type" = 'inbound' AND l."ref_id" = i."id"
       );

-- (2-b) 기존 폐기물 입고 → 재고 IN 소급 계상
INSERT INTO "inventory_ledger" ("id", "project_id", "item_code", "direction", "weight", "ledger_date", "ref_type", "ref_id", "created_at")
SELECT gen_random_uuid(), w."project_id", COALESCE(w."item_code", 'UNCLASSIFIED'), 'IN',
       w."net_weight", w."receive_date", 'waste_inbound', w."id", CURRENT_TIMESTAMP
  FROM "waste_inbound" w
 WHERE NOT EXISTS (
         SELECT 1 FROM "inventory_ledger" l
          WHERE l."ref_type" = 'waste_inbound' AND l."ref_id" = w."id"
       );

-- (3-a) 기존 선별의 원품목을 미분류로 채운다
UPDATE "sorting" SET "source_item_code" = 'UNCLASSIFIED' WHERE "source_item_code" IS NULL;

-- (3-b) 기존 선별에 상계 OUT을 넣어 순증 0으로 되돌린다
INSERT INTO "inventory_ledger" ("id", "project_id", "item_code", "direction", "weight", "ledger_date", "ref_type", "ref_id", "created_at")
SELECT gen_random_uuid(), s."project_id", s."source_item_code", 'OUT',
       s."sort_weight", s."sort_date", 'sorting', s."id", CURRENT_TIMESTAMP
  FROM "sorting" s
 WHERE NOT EXISTS (
         SELECT 1 FROM "inventory_ledger" l
          WHERE l."ref_type" = 'sorting' AND l."ref_id" = s."id" AND l."direction" = 'OUT'
       );
