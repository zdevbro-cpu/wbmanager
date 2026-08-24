-- 직납 — 출고와 함께 만들어진 입고 건을 가리킨다. 출고를 고치거나 지우면 이 입고도 따라간다.
ALTER TABLE "outbound_sale" ADD COLUMN "direct_inbound_id" TEXT;
