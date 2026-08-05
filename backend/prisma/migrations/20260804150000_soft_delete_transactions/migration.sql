-- 소프트 삭제. 삭제된 건은 목록/원장/집계/내보내기에서 제외하되 데이터는 보존한다.
-- AlterTable
ALTER TABLE "inbound" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "waste_inbound" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "outbound_sale" ADD COLUMN     "deleted_at" TIMESTAMP(3);
