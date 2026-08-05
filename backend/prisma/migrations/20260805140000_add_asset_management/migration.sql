-- 차량·장비 통합 자산관리 1차 (data/차량장비_자산관리_설계정리.md)
CREATE TABLE "asset" (
    "id" TEXT NOT NULL,
    "asset_no" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "model_name" TEXT,
    "manufacturer" TEXT,
    "serial_no" TEXT,
    "owner_dept" TEXT,
    "manager_emp_id" TEXT,
    "location" TEXT,
    "ownership_type" TEXT,
    "acquired_at" TIMESTAMP(3),
    "acquire_cost" DECIMAL(14,2),
    "useful_life_month" INTEGER,
    "status" TEXT NOT NULL DEFAULT '가용',
    "disposed_at" TIMESTAMP(3),
    "dispose_reason" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_asset_no_key" ON "asset"("asset_no");

ALTER TABLE "asset" ADD CONSTRAINT "asset_manager_emp_id_fkey"
  FOREIGN KEY ("manager_emp_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "asset_vehicle" (
    "asset_id" TEXT NOT NULL,
    "plate_no" TEXT,
    "vin" TEXT,
    "vehicle_type" TEXT,
    "fuel_type" TEXT,
    "year_model" TEXT,
    "load_capacity" TEXT,
    "current_mileage" INTEGER,
    "insurance_company" TEXT,
    "insurance_end" TIMESTAMP(3),
    "inspection_next" TIMESTAMP(3),
    "lease_company" TEXT,
    "lease_end" TIMESTAMP(3),

    CONSTRAINT "asset_vehicle_pkey" PRIMARY KEY ("asset_id")
);

ALTER TABLE "asset_vehicle" ADD CONSTRAINT "asset_vehicle_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "asset_equipment" (
    "asset_id" TEXT NOT NULL,
    "spec" TEXT,
    "power_type" TEXT,
    "requires_license" BOOLEAN NOT NULL DEFAULT false,
    "license_type" TEXT,
    "is_legal_inspection" BOOLEAN NOT NULL DEFAULT false,
    "inspection_cycle_month" INTEGER,
    "inspection_next" TIMESTAMP(3),
    "calibration_next" TIMESTAMP(3),
    "warranty_end" TIMESTAMP(3),
    "quantity" INTEGER,

    CONSTRAINT "asset_equipment_pkey" PRIMARY KEY ("asset_id")
);

ALTER TABLE "asset_equipment" ADD CONSTRAINT "asset_equipment_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "asset_schedule" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "alert_days_before" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT '예정',
    "completed_at" TIMESTAMP(3),
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_schedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "asset_schedule" ADD CONSTRAINT "asset_schedule_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 첨부(차량등록증·보험증권·검사증·매뉴얼·사진)를 자산에 연결
ALTER TABLE "attachment" ADD COLUMN "asset_id" TEXT;
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 자산 분류·상태 등은 공통코드에서 관리한다.
INSERT INTO "common_code" ("id", "group", "label", "sort_order")
VALUES
  (gen_random_uuid(), '자산 분류', '승용', 0),
  (gen_random_uuid(), '자산 분류', '화물', 1),
  (gen_random_uuid(), '자산 분류', '특수', 2),
  (gen_random_uuid(), '자산 분류', '지게차', 3),
  (gen_random_uuid(), '자산 분류', '굴착기', 4),
  (gen_random_uuid(), '자산 분류', '어테치', 5),
  (gen_random_uuid(), '자산 분류', '발전기', 6),
  (gen_random_uuid(), '자산 분류', '측정기', 7),
  (gen_random_uuid(), '자산 분류', '공구', 8),
  (gen_random_uuid(), '일정 구분', '보험만료', 0),
  (gen_random_uuid(), '일정 구분', '정기검사', 1),
  (gen_random_uuid(), '일정 구분', '정기점검', 2),
  (gen_random_uuid(), '일정 구분', '교정', 3),
  (gen_random_uuid(), '일정 구분', '리스만료', 4),
  (gen_random_uuid(), '일정 구분', '소모품교체', 5);
