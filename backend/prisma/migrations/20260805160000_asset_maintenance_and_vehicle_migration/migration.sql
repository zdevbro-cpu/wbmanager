-- 자산 정비·이동 이력 + 기존 차량/장비(vehicle) 데이터 자산으로 이관
CREATE TABLE "asset_maintenance" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "maint_type" TEXT NOT NULL,
    "vendor_id" TEXT,
    "requested_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "mileage_at" INTEGER,
    "hours_at" INTEGER,
    "symptom" TEXT,
    "action" TEXT,
    "parts" TEXT,
    "cost" DECIMAL(14,2),
    "next_due_date" TIMESTAMP(3),
    "next_due_mileage" INTEGER,
    "status" TEXT NOT NULL DEFAULT '요청',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "asset_movement" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "move_date" TIMESTAMP(3) NOT NULL,
    "from_site" TEXT,
    "to_site" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_movement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_movement" ADD CONSTRAINT "asset_movement_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachment" ADD COLUMN "asset_maintenance_id" TEXT;
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_asset_maintenance_id_fkey"
  FOREIGN KEY ("asset_maintenance_id") REFERENCES "asset_maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 기존 vehicle 데이터를 자산으로 이관 ───────────────────────────────
-- 자산번호는 V-{등록연도}-{일련번호}. 이미 같은 차량번호의 자산이 있으면 건너뛴다.
CREATE TEMP TABLE _vehicle_map AS
WITH numbered AS (
  SELECT
    v.id AS vehicle_id,
    v."vehicle_no",
    v."vehicle_type",
    v."inspection_expiry",
    v."current_site",
    to_char(v."created_at", 'YYYY') AS yr,
    row_number() OVER (PARTITION BY to_char(v."created_at", 'YYYY') ORDER BY v."vehicle_no") AS seq
  FROM "vehicle" v
  WHERE NOT EXISTS (SELECT 1 FROM "asset_vehicle" av WHERE av."plate_no" = v."vehicle_no")
)
SELECT
  vehicle_id,
  gen_random_uuid() AS asset_id,
  'V-' || yr || '-' || lpad(seq::text, 3, '0') AS asset_no,
  "vehicle_no",
  "vehicle_type",
  "inspection_expiry",
  "current_site"
FROM numbered;

INSERT INTO "asset" ("id", "asset_no", "asset_type", "category", "name", "location", "status", "created_at", "updated_at")
SELECT asset_id, asset_no, 'VEHICLE', "vehicle_type", "vehicle_no", "current_site", '가용', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _vehicle_map;

INSERT INTO "asset_vehicle" ("asset_id", "plate_no", "vehicle_type", "inspection_next")
SELECT asset_id, "vehicle_no", "vehicle_type", "inspection_expiry"
FROM _vehicle_map;

-- 검사 만료일은 일정으로도 만들어 알림 소스를 하나로 유지한다.
INSERT INTO "asset_schedule" ("id", "asset_id", "schedule_type", "due_date", "alert_days_before", "status", "created_at")
SELECT gen_random_uuid(), asset_id, '정기검사', "inspection_expiry", 30, '예정', CURRENT_TIMESTAMP
FROM _vehicle_map
WHERE "inspection_expiry" IS NOT NULL;

-- 정비 이력 이관
CREATE TEMP TABLE _maint_map AS
SELECT vm.id AS old_id, gen_random_uuid() AS new_id, m.asset_id, vm."maintenance_date", vm."description", vm."cost"
FROM "vehicle_maintenance" vm
JOIN _vehicle_map m ON m.vehicle_id = vm."vehicle_id";

INSERT INTO "asset_maintenance" ("id", "asset_id", "maint_type", "completed_at", "action", "cost", "status", "created_at")
SELECT new_id, asset_id, '수리', "maintenance_date", "description", "cost", '완료', CURRENT_TIMESTAMP
FROM _maint_map;

-- 이동 내역 이관
INSERT INTO "asset_movement" ("id", "asset_id", "move_date", "from_site", "to_site", "created_at")
SELECT gen_random_uuid(), m.asset_id, mv."move_date", mv."from_site", mv."to_site", CURRENT_TIMESTAMP
FROM "vehicle_movement" mv
JOIN _vehicle_map m ON m.vehicle_id = mv."vehicle_id";

-- 첨부(차량등록증·검사증·정비명세서) 재연결
UPDATE "attachment" a
SET "asset_id" = m.asset_id
FROM _vehicle_map m
WHERE a."vehicle_id" = m.vehicle_id AND a."asset_id" IS NULL;

UPDATE "attachment" a
SET "asset_maintenance_id" = mm.new_id
FROM _maint_map mm
WHERE a."vehicle_maintenance_id" = mm.old_id AND a."asset_maintenance_id" IS NULL;

DROP TABLE _vehicle_map;
DROP TABLE _maint_map;

-- 정비 구분도 공통코드로 관리한다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order")
VALUES
  (gen_random_uuid(), '정비 구분', '정기점검', 0),
  (gen_random_uuid(), '정비 구분', '수리', 1),
  (gen_random_uuid(), '정비 구분', '소모품교체', 2),
  (gen_random_uuid(), '정비 구분', '사고수리', 3),
  (gen_random_uuid(), '정비 구분', '법정검사', 4),
  (gen_random_uuid(), '정비 구분', '교정', 5)
ON CONFLICT ("group", "label") DO NOTHING;
