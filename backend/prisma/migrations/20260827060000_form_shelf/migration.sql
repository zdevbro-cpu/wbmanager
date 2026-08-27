-- 양식함과 계약서 자리 정리
--
-- 1) 빈 서식은 작성된 문서와 성격이 다르다. 문서일자도 실물 보관 의무도 없고,
--    쓰려고 꺼내는 것이지 보관하려고 넣는 것이 아니다. 따로 담을 자리를 만든다.
INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), p."id", 2, 'DOC-05-05', '양식함', 4, 'UPLOAD', false, true, now()
FROM "document_type" p
WHERE p."code" = 'DOC-05'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = 'DOC-05-05');

INSERT INTO "document_type" ("id", "parent_id", "level", "code", "name", "sort_order", "origin", "is_system", "is_active", "created_at")
SELECT gen_random_uuid(), p."id", 3, v."code", v."name", v."ord", 'UPLOAD', false, true, now()
FROM "document_type" p
CROSS JOIN (VALUES
  ('DOC-05-05-001', '계약서 양식', 0),
  ('DOC-05-05-002', '공문 양식', 1),
  ('DOC-05-05-003', '신고 양식', 2),
  ('DOC-05-05-004', '기타 양식', 3)
) AS v("code", "name", "ord")
WHERE p."code" = 'DOC-05-05'
  AND NOT EXISTS (SELECT 1 FROM "document_type" x WHERE x."code" = v."code");

-- 2) 자산에 올린 계약서는 이제 계약서끼리 모이는 자리로 간다.
--    문서는 자산에도 연결되므로 자산 상세의 문서함에서는 그대로 보인다.
--    자동 편입이 가리키게 되었으니 그 자리와 윗단계를 잠근다.
UPDATE "document_type" SET "is_system" = true
WHERE "code" IN ('DOC-05', 'DOC-05-01', 'DOC-05-01-005');
