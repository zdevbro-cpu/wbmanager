-- 단가관리 모듈 — 매각처별 판매단가. 엑셀 「단가관리」를 대신한다.
-- 기존 표는 건드리지 않는다. 새 표 5개만 만든다.

-- 업체가 부르는 품목. 같은 물건도 업체마다 이름이 달라 업체별로 따로 둔다.
CREATE TABLE "vendor_item" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_item_name" TEXT NOT NULL,
    "series" TEXT,
    "rep_item_name" TEXT,
    "item_code" TEXT,
    "definition" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_item_vendor_id_vendor_item_name_key" ON "vendor_item"("vendor_id", "vendor_item_name");
CREATE INDEX "vendor_item_item_code_idx" ON "vendor_item"("item_code");

-- 단가이력 — 이 모듈의 원장.
CREATE TABLE "vendor_price" (
    "id" TEXT NOT NULL,
    "vendor_item_id" TEXT NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "price_type" TEXT NOT NULL,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT '수기',
    "notice_id" TEXT,
    "outbound_sale_id" TEXT,
    "memo" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vendor_price_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_price_vendor_item_id_effective_date_idx" ON "vendor_price"("vendor_item_id", "effective_date");
CREATE INDEX "vendor_price_notice_id_idx" ON "vendor_price"("notice_id");

-- 같은 날 · 같은 품목 · 같은 구분은 한 건만 산다. 엑셀의 같은 날 중복(9건)을 막는다.
-- 지운 기록은 세지 않아, 지운 뒤 같은 날 다시 적는 것은 된다.
CREATE UNIQUE INDEX "vendor_price_live_day_key"
  ON "vendor_price"("vendor_item_id", "effective_date", "price_type")
  WHERE "deleted_at" IS NULL;

-- 업체 단가 공지. 저장만으로 단가를 바꾸지 않는다 — 확인한 뒤 일괄 반영한다.
CREATE TABLE "price_notice" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "notice_date" TIMESTAMP(3) NOT NULL,
    "series" TEXT,
    "scope" TEXT NOT NULL DEFAULT '전품목',
    "target_vendor_item_id" TEXT,
    "adjust_amount" DECIMAL(14,2) NOT NULL,
    "content" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_notice_vendor_id_notice_date_idx" ON "price_notice"("vendor_id", "notice_date");

-- LME 동 시세. A동·상동·중동은 저장하지 않고 조회할 때 계산한다.
CREATE TABLE "market_rate" (
    "id" TEXT NOT NULL,
    "rate_date" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'LME_CU',
    "value" DECIMAL(14,2) NOT NULL,
    "fx_rate" DECIMAL(12,4) NOT NULL,
    "memo" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_rate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_rate_rate_date_code_key" ON "market_rate"("rate_date", "code");

-- 계산 상수 — 97% · 19,000원 · 45/90일. 배포 없이 고칠 수 있게 표로 둔다.
CREATE TABLE "price_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "memo" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "vendor_item" ADD CONSTRAINT "vendor_item_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_price" ADD CONSTRAINT "vendor_price_vendor_item_id_fkey"
  FOREIGN KEY ("vendor_item_id") REFERENCES "vendor_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "price_notice" ADD CONSTRAINT "price_notice_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "price_notice" ADD CONSTRAINT "price_notice_target_vendor_item_id_fkey"
  FOREIGN KEY ("target_vendor_item_id") REFERENCES "vendor_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
