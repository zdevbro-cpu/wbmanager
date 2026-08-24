-- 외부 운전자 마스터 — 계근 등록에서 바로 등록해 두고 다음부터 검색해 쓴다.
CREATE TABLE "external_driver" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "memo" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_driver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_driver_name_key" ON "external_driver"("name");
