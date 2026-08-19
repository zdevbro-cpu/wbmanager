-- DMS 1단계 — 문서 분류 트리와 문서·버전 골격.
-- 설계 근거: docs/dms-design.md 2장(데이터 모델), 3.1 분류 트리, 3.2 코드 체계.
-- 분류는 대·중·소 3단 고정이며 self-reference 한 테이블로 관리한다.

CREATE TABLE "document_type" (
  "id"                    TEXT PRIMARY KEY,
  "parent_id"             TEXT REFERENCES "document_type"("id") ON DELETE CASCADE,
  "level"                 SMALLINT NOT NULL,              -- 1 대분류 / 2 중분류 / 3 소분류
  "code"                  VARCHAR(40) NOT NULL UNIQUE,    -- DOC-01-01-001
  "name"                  VARCHAR(100) NOT NULL,
  "sort_order"            INT NOT NULL DEFAULT 0,
  -- 소분류에만 의미가 있는 정책값 (설계 3.3)
  "retention_months"      INT,
  "require_physical_copy" BOOLEAN NOT NULL DEFAULT false,
  "default_acl_level"     VARCHAR(20),
  "origin"                VARCHAR(20) NOT NULL DEFAULT 'UPLOAD',  -- SYSTEM / UPLOAD
  "is_active"             BOOLEAN NOT NULL DEFAULT true,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "document_type_parent_idx" ON "document_type" ("parent_id", "sort_order");

-- 문서 — 설계상 단일 진실 원천. 드라이브 파일은 버전이 들고 있는 속성일 뿐이다.
CREATE TABLE "document" (
  "id"                 TEXT PRIMARY KEY,
  "doc_no"             VARCHAR(40) UNIQUE,
  "type_id"            TEXT REFERENCES "document_type"("id"),
  "title"              VARCHAR(300) NOT NULL,
  "description"        TEXT,
  "status"             VARCHAR(20) NOT NULL DEFAULT 'active',  -- draft/active/archived
  "current_version_id" TEXT,
  "owner_id"           TEXT,
  "meta"               JSONB,
  "retention_until"    DATE,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"         TIMESTAMPTZ
);

CREATE INDEX "document_type_status_idx" ON "document" ("type_id", "status", "created_at" DESC);

-- 버전 — append-only. 수정은 새 버전 추가로만 한다.
CREATE TABLE "document_version" (
  "id"              TEXT PRIMARY KEY,
  "document_id"     TEXT NOT NULL REFERENCES "document"("id") ON DELETE CASCADE,
  "version_no"      INT NOT NULL,
  "storage_kind"    VARCHAR(20) NOT NULL DEFAULT 'gdrive',
  "storage_key"     TEXT,
  "file_name"       VARCHAR(300),
  "mime_type"       VARCHAR(120),
  "byte_size"       BIGINT,
  "checksum_sha256" CHAR(64),
  "change_note"     TEXT,
  "uploaded_by"     TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("document_id", "version_no")
);

-- 업무 연결 — 한 문서를 여러 업무 레코드에 붙인다.
CREATE TABLE "document_link" (
  "id"          BIGSERIAL PRIMARY KEY,
  "document_id" TEXT NOT NULL REFERENCES "document"("id") ON DELETE CASCADE,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id"   TEXT NOT NULL,
  "relation"    VARCHAR(40) NOT NULL DEFAULT 'attachment',
  "sort_order"  INT NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("document_id", "entity_type", "entity_id", "relation")
);

CREATE INDEX "document_link_entity_idx" ON "document_link" ("entity_type", "entity_id");
