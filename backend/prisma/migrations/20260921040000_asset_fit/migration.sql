-- 어태치먼트가 붙는 장비 (리뷰회의 5-12)
--
-- 고객 메모: "어테치의 경우 사용가능 장비 표시(예를들어 350, 08굴착기 이렇게 표시함)"
--
-- 글자로 적어 두면 장비 이름이 바뀌어도 따라 바뀌지 않는다. 자산끼리 이어 둔다.
CREATE TABLE IF NOT EXISTS "asset_fit" (
  "id" TEXT NOT NULL,
  "attachment_asset_id" TEXT NOT NULL,
  "equipment_asset_id" TEXT NOT NULL,
  "memo" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_fit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_fit_pair_key" ON "asset_fit"("attachment_asset_id", "equipment_asset_id");
CREATE INDEX IF NOT EXISTS "asset_fit_equipment_idx" ON "asset_fit"("equipment_asset_id");

DO $$ BEGIN
  ALTER TABLE "asset_fit" ADD CONSTRAINT "asset_fit_attachment_asset_id_fkey"
    FOREIGN KEY ("attachment_asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "asset_fit" ADD CONSTRAINT "asset_fit_equipment_asset_id_fkey"
    FOREIGN KEY ("equipment_asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
