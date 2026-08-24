-- 폐기물 반출에 적은 운반비로 자동 생성한 운반비 건을 되짚기 위한 연결 고리.
-- 반출 건을 고치거나 지우면 짝이 된 운반비 건도 같이 따라간다.
ALTER TABLE "transport" ADD COLUMN "waste_outbound_id" TEXT;
CREATE UNIQUE INDEX "transport_waste_outbound_id_key" ON "transport"("waste_outbound_id");
