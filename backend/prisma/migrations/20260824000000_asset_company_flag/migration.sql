-- 회사자산 구분
-- 차량·장비 중에는 회사가 보유·관리하는 것과, 운송만 맡고 기록에만 남는 외부 것이 섞여 있다.
-- 정비는 회사가 책임지는 자산에 대해서만 관리하므로 둘을 구분한다.
ALTER TABLE "asset" ADD COLUMN "is_company_asset" BOOLEAN NOT NULL DEFAULT true;

-- 계근 등록에서 차량번호만 적어 만들어진 차량(자산번호가 V-<차량번호> 꼴)은
-- 운송만 맡는 외부 차량이다. 정식 채번(V-2026-001)과 형태가 다르므로 그것으로 가른다.
-- 잘못 분류된 건은 자산 관리 화면에서 구분을 바꾸면 된다.
UPDATE "asset"
SET "is_company_asset" = false
WHERE "asset_type" = 'VEHICLE'
  AND "asset_no" !~ '^V-[0-9]{4}-[0-9]+$';
