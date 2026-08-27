-- 계정과 임직원 연결
-- 출퇴근을 찍을 때 "나"가 누구인지 알아야 한다. 계정에 연결해 두면 매번 고르지 않아도 된다.
-- 연결이 없는 계정(현장 관리자가 대신 찍어 주는 경우)은 화면에서 직접 고른다.
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
