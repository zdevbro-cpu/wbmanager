-- CreateTable
CREATE TABLE "item_price_history" (
    "id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "project_id" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_price_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_item_code_fkey" FOREIGN KEY ("item_code") REFERENCES "item_master"("item_code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
