-- 발행 시점 데이터를 남겨 워드 문서를 언제든 동일하게 다시 만든다.
ALTER TABLE "report" ADD COLUMN "payload" JSONB;
