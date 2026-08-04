-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor_type" TEXT,
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_master" (
    "id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "item_name" TEXT NOT NULL,
    "base_price" DECIMAL(14,2),
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "round_name" TEXT NOT NULL,
    "buyer_id" TEXT,
    "purchase_price" DECIMAL(14,2),
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT '진행',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker" (
    "id" TEXT NOT NULL,
    "affiliation" TEXT,
    "name" TEXT NOT NULL,
    "daily_wage" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "inbound_date" TIMESTAMP(3) NOT NULL,
    "loading_point" TEXT,
    "unloading_point" TEXT,
    "vehicle_no" TEXT,
    "driver_name" TEXT,
    "vehicle_type" TEXT,
    "gross_weight" DECIMAL(12,3) NOT NULL,
    "tare_weight" DECIMAL(12,3) NOT NULL,
    "net_weight" DECIMAL(12,3) NOT NULL,
    "storage_zone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorting" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "sort_date" TIMESTAMP(3) NOT NULL,
    "sort_weight" DECIMAL(12,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "ledger_date" TIMESTAMP(3) NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_sale" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "outbound_date" TIMESTAMP(3) NOT NULL,
    "buyer_id" TEXT,
    "unit_price" DECIMAL(12,2),
    "gross_weight" DECIMAL(12,3),
    "tare_weight" DECIMAL(12,3),
    "loss_weight" DECIMAL(12,3),
    "settled_weight" DECIMAL(12,3) NOT NULL,
    "amount" DECIMAL(14,2),
    "tax_invoice_issued" BOOLEAN NOT NULL DEFAULT false,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_outbound" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "outbound_date" TIMESTAMP(3) NOT NULL,
    "buyer_id" TEXT,
    "item_code" TEXT,
    "item_name" TEXT,
    "weight" DECIMAL(12,3) NOT NULL,
    "amount" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_outbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "transport_date" TIMESTAMP(3) NOT NULL,
    "vehicle_no" TEXT,
    "weight" DECIMAL(12,3),
    "vehicle_type" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "supply_amount" DECIMAL(14,2),
    "tax_amount" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "total_man_days" DECIMAL(8,3),
    "labor_cost" DECIMAL(14,2),
    "meal_cost" DECIMAL(14,2),
    "tool_cost" DECIMAL(14,2),
    "fuel_cost" DECIMAL(14,2),
    "supplies_cost" DECIMAL(14,2),
    "total_amount" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_attendance" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "work_date" TIMESTAMP(3) NOT NULL,
    "man_days" DECIMAL(4,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "vehicle_no" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "inspection_expiry" TIMESTAMP(3),
    "current_site" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_movement" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "move_date" TIMESTAMP(3) NOT NULL,
    "from_site" TEXT,
    "to_site" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "maintenance_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "hire_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certification" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cert_name" TEXT NOT NULL,
    "acquired_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_training" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "training_name" TEXT NOT NULL,
    "training_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "drive_file_id" TEXT NOT NULL,
    "file_name" TEXT,
    "file_type" TEXT,
    "web_view_link" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inbound_id" TEXT,
    "outbound_sale_id" TEXT,
    "waste_outbound_id" TEXT,
    "vehicle_maintenance_id" TEXT,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_master_item_code_key" ON "item_master"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_vehicle_no_key" ON "vehicle"("vehicle_no");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound" ADD CONSTRAINT "inbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting" ADD CONSTRAINT "sorting_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sorting" ADD CONSTRAINT "sorting_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_sale" ADD CONSTRAINT "outbound_sale_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_sale" ADD CONSTRAINT "outbound_sale_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_sale" ADD CONSTRAINT "outbound_sale_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_outbound" ADD CONSTRAINT "waste_outbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_outbound" ADD CONSTRAINT "waste_outbound_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_outbound" ADD CONSTRAINT "waste_outbound_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport" ADD CONSTRAINT "transport_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor" ADD CONSTRAINT "labor_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_attendance" ADD CONSTRAINT "worker_attendance_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_attendance" ADD CONSTRAINT "worker_attendance_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_movement" ADD CONSTRAINT "vehicle_movement_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certification" ADD CONSTRAINT "employee_certification_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_training" ADD CONSTRAINT "employee_training_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_inbound_id_fkey" FOREIGN KEY ("inbound_id") REFERENCES "inbound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_outbound_sale_id_fkey" FOREIGN KEY ("outbound_sale_id") REFERENCES "outbound_sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_waste_outbound_id_fkey" FOREIGN KEY ("waste_outbound_id") REFERENCES "waste_outbound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_vehicle_maintenance_id_fkey" FOREIGN KEY ("vehicle_maintenance_id") REFERENCES "vehicle_maintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
