-- 거래처 마스터 — 세금계산서 발행에 필요한 업체 정보
ALTER TABLE "vendor" ADD COLUMN "biz_reg_no" TEXT;
ALTER TABLE "vendor" ADD COLUMN "corp_reg_no" TEXT;
ALTER TABLE "vendor" ADD COLUMN "ceo_name" TEXT;
ALTER TABLE "vendor" ADD COLUMN "biz_type" TEXT;
ALTER TABLE "vendor" ADD COLUMN "biz_item" TEXT;
ALTER TABLE "vendor" ADD COLUMN "address" TEXT;
ALTER TABLE "vendor" ADD COLUMN "phone" TEXT;
ALTER TABLE "vendor" ADD COLUMN "fax" TEXT;
ALTER TABLE "vendor" ADD COLUMN "contact_name" TEXT;
ALTER TABLE "vendor" ADD COLUMN "contact_phone" TEXT;
ALTER TABLE "vendor" ADD COLUMN "contact_email" TEXT;
ALTER TABLE "vendor" ADD COLUMN "memo" TEXT;

-- 품목 마스터 — data/품목마스터_설계.md 반영
-- 식별·분류
ALTER TABLE "item_master" ADD COLUMN "alias_names" TEXT;
ALTER TABLE "item_master" ADD COLUMN "minor_category" TEXT;
ALTER TABLE "item_master" ADD COLUMN "material" TEXT;
ALTER TABLE "item_master" ADD COLUMN "grade" TEXT;

-- 단위·수량
ALTER TABLE "item_master" ADD COLUMN "base_unit" TEXT DEFAULT 'kg';
ALTER TABLE "item_master" ADD COLUMN "weigh_unit" TEXT;
ALTER TABLE "item_master" ADD COLUMN "purchase_unit" TEXT;
ALTER TABLE "item_master" ADD COLUMN "sales_unit" TEXT;
ALTER TABLE "item_master" ADD COLUMN "unit_factor" DECIMAL(14,6);
ALTER TABLE "item_master" ADD COLUMN "qty_managed" BOOLEAN NOT NULL DEFAULT false;

-- 스크랩 업종 특수
ALTER TABLE "item_master" ADD COLUMN "usage_type" TEXT DEFAULT '공용';
ALTER TABLE "item_master" ADD COLUMN "convert_to_item_code" TEXT;
ALTER TABLE "item_master" ADD COLUMN "expected_yield" DECIMAL(6,3);
ALTER TABLE "item_master" ADD COLUMN "deduct_impurity" DECIMAL(6,3);
ALTER TABLE "item_master" ADD COLUMN "deduct_soil" DECIMAL(6,3);
ALTER TABLE "item_master" ADD COLUMN "deduct_moisture" DECIMAL(6,3);
ALTER TABLE "item_master" ADD COLUMN "zone_code" TEXT;
ALTER TABLE "item_master" ADD COLUMN "price_linked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "item_master" ADD COLUMN "price_ref_code" TEXT;

-- 세무·회계
ALTER TABLE "item_master" ADD COLUMN "tax_type" TEXT DEFAULT '과세';
ALTER TABLE "item_master" ADD COLUMN "recycle_deductible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "item_master" ADD COLUMN "ecount_item_code" TEXT;
ALTER TABLE "item_master" ADD COLUMN "account_code" TEXT;

-- 상태 관리
ALTER TABLE "item_master" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "item_master" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "item_master" ADD COLUMN "created_by" TEXT;
