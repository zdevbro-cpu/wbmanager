-- 폐기물 반출 운반비 — 보고 양식의 운반비 칸을 채우기 위해 등록에서 받는다.
ALTER TABLE "waste_outbound" ADD COLUMN "transport_cost" DECIMAL(14,2);
