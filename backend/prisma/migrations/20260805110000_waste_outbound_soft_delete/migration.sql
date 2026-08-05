-- 폐기물 반출도 입고·매각과 동일하게 소프트 삭제를 적용한다.
ALTER TABLE "waste_outbound" ADD COLUMN "deleted_at" TIMESTAMP(3);
