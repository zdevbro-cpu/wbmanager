-- AlterTable
ALTER TABLE "outbound_sale" ADD COLUMN     "actual_weight" DECIMAL(12,3),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "driver_name" TEXT,
ADD COLUMN     "driver_phone" TEXT,
ADD COLUMN     "is_subsidiary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loading_point" TEXT,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "paid_date" TIMESTAMP(3),
ADD COLUMN     "pre_loss_weight" DECIMAL(12,3),
ADD COLUMN     "stock_weight" DECIMAL(12,3),
ADD COLUMN     "vat_amount" DECIMAL(14,2),
ADD COLUMN     "vehicle_no" TEXT,
ADD COLUMN     "vehicle_type" TEXT;

-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "attachment" ADD COLUMN     "vehicle_id" TEXT;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 출고 건의 재고반영중량(ecount 필수 항목)을 정산중량과 동기화하고,
-- 실중량(총중량 - 공차중량)을 소급 계산한다.
UPDATE "outbound_sale" SET "stock_weight" = "settled_weight" WHERE "stock_weight" IS NULL;
UPDATE "outbound_sale"
   SET "actual_weight" = "gross_weight" - "tare_weight"
 WHERE "actual_weight" IS NULL AND "gross_weight" IS NOT NULL AND "tare_weight" IS NOT NULL;
