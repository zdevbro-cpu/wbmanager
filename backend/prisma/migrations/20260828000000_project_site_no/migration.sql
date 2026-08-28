-- 현장번호 — 출퇴근 단말에서 말과 상관없이 현장을 가리키는 번호.
-- 한 번 준 번호는 다시 쓰지 않는다. 번호가 밀리면 어제 3번이던 현장이
-- 오늘 다른 현장이 되어, 읽지 못하는 사람은 그 사실을 알 길이 없다.
ALTER TABLE "project" ADD COLUMN "site_no" INTEGER;
CREATE UNIQUE INDEX "project_site_no_key" ON "project"("site_no");
