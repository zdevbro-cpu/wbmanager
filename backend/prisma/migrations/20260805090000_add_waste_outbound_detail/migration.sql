-- 폐기물 반출 상세 컬럼 추가 (원본 `폐기물출고량` 시트 컬럼 대조)
ALTER TABLE "waste_outbound" ADD COLUMN "discharger_name" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "transporter_name" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "loading_point" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "vehicle_type" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "vehicle_no" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "driver_name" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "driver_phone" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "gross_weight" DECIMAL(12,3);
ALTER TABLE "waste_outbound" ADD COLUMN "tare_weight" DECIMAL(12,3);
ALTER TABLE "waste_outbound" ADD COLUMN "actual_weight" DECIMAL(12,3);
ALTER TABLE "waste_outbound" ADD COLUMN "pre_loss_weight" DECIMAL(12,3);
ALTER TABLE "waste_outbound" ADD COLUMN "loss_weight" DECIMAL(12,3);
ALTER TABLE "waste_outbound" ADD COLUMN "unit_price" DECIMAL(12,2);
ALTER TABLE "waste_outbound" ADD COLUMN "cubic_meter" DECIMAL(10,2);
ALTER TABLE "waste_outbound" ADD COLUMN "category" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "memo" TEXT;
ALTER TABLE "waste_outbound" ADD COLUMN "is_subsidiary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "waste_outbound" ADD COLUMN "transfer_date" TIMESTAMP(3);
