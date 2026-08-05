-- 가입 신청 시 연락처를 받아 승인 담당자가 본인 확인·연락에 쓸 수 있게 한다.
-- 기존 계정은 신청 시점에 항목이 없었으므로 NULL로 둔다.
-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "phone" TEXT;
