-- AlterTable
ALTER TABLE "inbound" ADD COLUMN     "driver_phone" TEXT,
ADD COLUMN     "item_code" TEXT,
ADD COLUMN     "item_name" TEXT,
ADD COLUMN     "loss_weight" DECIMAL(12,3),
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "stock_weight" DECIMAL(12,3);

-- AlterTable
ALTER TABLE "attachment" ADD COLUMN     "waste_inbound_id" TEXT;

-- CreateTable
CREATE TABLE "waste_inbound" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "receive_date" TIMESTAMP(3) NOT NULL,
    "handover_date" TIMESTAMP(3),
    "olbaro_reported" BOOLEAN NOT NULL DEFAULT false,
    "discharger_name" TEXT,
    "unloading_point" TEXT,
    "vehicle_no" TEXT,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "vehicle_type" TEXT,
    "item_code" TEXT,
    "item_name" TEXT,
    "gross_weight" DECIMAL(12,3) NOT NULL,
    "tare_weight" DECIMAL(12,3) NOT NULL,
    "loss_weight" DECIMAL(12,3),
    "net_weight" DECIMAL(12,3) NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_inbound_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "inbound" ADD CONSTRAINT "inbound_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_inbound" ADD CONSTRAINT "waste_inbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_inbound" ADD CONSTRAINT "waste_inbound_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_waste_inbound_id_fkey" FOREIGN KEY ("waste_inbound_id") REFERENCES "waste_inbound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 입고 건의 재고반영중량(ecount 필수 항목)을 입고량과 동기화한다.
UPDATE "inbound" SET "stock_weight" = "net_weight" WHERE "stock_weight" IS NULL;
