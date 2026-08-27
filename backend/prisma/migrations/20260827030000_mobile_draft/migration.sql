-- 임시저장 표시
-- 현장에서 휴대폰으로 올린 계근은 사진에서 읽은 값이 섞여 있어 사무실 확인이 필요하다.
-- 확인 전까지 「임시저장」으로 표시하고, 확인이 끝나면 정상등록으로 바꾼다.
-- 재고·집계에는 지금처럼 바로 반영된다 — 현장 흐름을 막지 않기 위해서다.
ALTER TABLE "inbound" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "waste_inbound" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "outbound_sale" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "waste_outbound" ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false;
