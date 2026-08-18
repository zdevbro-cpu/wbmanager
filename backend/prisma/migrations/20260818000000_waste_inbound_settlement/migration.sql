-- 폐기물 입고에도 반출과 같은 정산 항목을 둔다 — 운반자·처리자·실중량·정산중량·루베·단가·금액·이체일
ALTER TABLE "waste_inbound" ADD COLUMN "transporter_name" TEXT;
ALTER TABLE "waste_inbound" ADD COLUMN "processor_name" TEXT;
ALTER TABLE "waste_inbound" ADD COLUMN "actual_weight" DECIMAL(12,3);
ALTER TABLE "waste_inbound" ADD COLUMN "settled_weight" DECIMAL(12,3);
ALTER TABLE "waste_inbound" ADD COLUMN "cubic_meter" DECIMAL(12,3);
ALTER TABLE "waste_inbound" ADD COLUMN "unit_price" DECIMAL(12,2);
ALTER TABLE "waste_inbound" ADD COLUMN "amount" DECIMAL(14,2);
ALTER TABLE "waste_inbound" ADD COLUMN "transfer_date" TIMESTAMP(3);

-- 기존 건은 계근값에서 채워 둔다.
UPDATE "waste_inbound"
SET "actual_weight" = "gross_weight" - "tare_weight",
    "settled_weight" = "net_weight"
WHERE "actual_weight" IS NULL;
