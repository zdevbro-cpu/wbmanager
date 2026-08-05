-- 공통코드 테이블
CREATE TABLE "common_code" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "common_code_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "common_code_group_label_key" ON "common_code"("group", "label");

-- 기존 폼에 하드코딩되어 있던 차종 목록을 초기값으로 이관
INSERT INTO "common_code" ("id", "group", "label", "sort_order")
VALUES
  (gen_random_uuid(), '차종', '집게차', 0),
  (gen_random_uuid(), '차종', '카고', 1),
  (gen_random_uuid(), '차종', '암롤트럭', 2),
  (gen_random_uuid(), '차종', '방통차', 3),
  (gen_random_uuid(), '차종', '1톤트럭', 4),
  (gen_random_uuid(), '차종', '트레일러', 5),
  (gen_random_uuid(), '차종', '탱크로리', 6),
  (gen_random_uuid(), '차종', '기타', 7),
  (gen_random_uuid(), '거래 구분', '출고', 0),
  (gen_random_uuid(), '거래 구분', '이동', 1),
  (gen_random_uuid(), '거래 구분', '보류', 2),
  (gen_random_uuid(), '거래 구분', '기타', 3),
  (gen_random_uuid(), '제출서류 종류', '계량증명서', 0),
  (gen_random_uuid(), '제출서류 종류', '참고서류', 1),
  (gen_random_uuid(), '제출서류 종류', '현장사진', 2),
  (gen_random_uuid(), '제출서류 종류', '정비명세서', 3),
  (gen_random_uuid(), '제출서류 종류', '차량등록증', 4),
  (gen_random_uuid(), '제출서류 종류', '검사증', 5);
