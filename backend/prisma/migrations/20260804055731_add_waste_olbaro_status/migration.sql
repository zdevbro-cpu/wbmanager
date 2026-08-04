-- AlterTable
ALTER TABLE "waste_outbound" ADD COLUMN     "handover_date" TIMESTAMP(3),
ADD COLUMN     "olbaro_memo" TEXT,
ADD COLUMN     "olbaro_reported" BOOLEAN NOT NULL DEFAULT false;
