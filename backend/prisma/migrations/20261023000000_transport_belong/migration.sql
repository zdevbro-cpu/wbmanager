-- 운반비 별도 입력 (회의 2026-10-14 4번)
-- 입출고에 딸리지 않는 운반도 적을 수 있게 프로젝트를 선택으로 바꾸고,
-- 이 비용이 어디에 속하는지 적는 칸을 둔다.

ALTER TABLE "transport" ALTER COLUMN "project_id" DROP NOT NULL;

ALTER TABLE "transport" ADD COLUMN IF NOT EXISTS "belong_to" TEXT NOT NULL DEFAULT '프로젝트';

-- 지금까지 쌓인 운반비는 모두 현장에 딸린 것이다.
UPDATE "transport" SET "belong_to" = '프로젝트' WHERE "belong_to" IS NULL;
