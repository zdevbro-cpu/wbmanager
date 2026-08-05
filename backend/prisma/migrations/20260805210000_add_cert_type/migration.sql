-- 교육에는 구분(의무/보수)이 있는데 자격에는 없어 목록에서 성격을 구분할 수 없었다.
-- 기존 자격 이력은 구분을 모르므로 NULL로 둔다.
-- AlterTable
ALTER TABLE "employee_certification" ADD COLUMN     "cert_type" TEXT;
