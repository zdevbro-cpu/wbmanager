-- 문서에 딸린 첨부자료 — 본문 파일 외에 함께 받은 참고 자료를 여러 개 붙인다.
-- 버전(document_version)은 본문 파일의 이력이고, 이쪽은 부속 자료라 따로 둔다.
CREATE TABLE "document_attachment" (
  "id"          TEXT PRIMARY KEY,
  "document_id" TEXT NOT NULL REFERENCES "document"("id") ON DELETE CASCADE,
  "storage_kind" VARCHAR(20) NOT NULL DEFAULT 'gdrive',
  "storage_key" TEXT,
  "file_name"   VARCHAR(300),
  "mime_type"   VARCHAR(120),
  "byte_size"   BIGINT,
  "uploaded_by" TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "document_attachment_doc_idx" ON "document_attachment" ("document_id");
