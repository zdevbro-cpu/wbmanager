-- 묶음(품목 분류)별 평균단가 (요청 2026-11-13)
--
-- 품목마다 단가를 일일이 넣기 어려워, 고철·비철·구리·폐기물처럼 묶음으로 묶어
-- 평균단가 하나를 정해 두고 그 묶음의 품목을 평가한다.
-- 품목에 제 단가가 있으면 그것이 먼저고, 없을 때 이 값을 쓴다.

CREATE TABLE IF NOT EXISTS "item_group_price" (
  "category"   TEXT NOT NULL,
  "price"      DECIMAL(14,2) NOT NULL,
  "memo"       TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_group_price_pkey" PRIMARY KEY ("category")
);

-- 쓰시는 분류를 미리 깔아 둔다. 값은 0으로 두고 화면에서 채운다.
INSERT INTO "item_group_price" ("category", "price")
VALUES ('고철', 0), ('비철', 0), ('구리', 0), ('폐기물 스크랩', 0)
ON CONFLICT ("category") DO NOTHING;
