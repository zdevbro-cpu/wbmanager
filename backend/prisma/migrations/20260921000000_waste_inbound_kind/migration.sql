-- 폐기물 수집·운반 — 입고 · 운반 · 참고 구분
--
-- 리뷰회의(2026-09-18) 5-1. 고객 메모 그대로:
--   "운반 만 한 경우 입고로 잡으면 안 됨 / 구분 할 수 있도록(입고, 운반, 참고)
--    * 입고 만 순수 입고로 잡을 수 있도록"
--
-- 지금까지는 수집·운반 건이 모두 재고에 입고로 쌓이고 손익의 회수율 분모에도 들어갔다.
-- 남의 물건을 실어다 준 것까지 우리 재고로 잡히면, 팔 물건이 있는데 안 파는 것처럼 보인다.
ALTER TABLE "waste_inbound" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT '입고';

-- 지난 자료는 그대로 「입고」로 둔다. 실제로 운반만 한 건은 화면에서 사람이 골라 바꾼다.
CREATE INDEX IF NOT EXISTS "waste_inbound_kind_idx" ON "waste_inbound"("kind");
