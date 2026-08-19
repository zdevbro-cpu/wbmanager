-- 감사 로그에 대상 식별자를 둔다 — 문서별 이력을 뽑기 위해서다(설계 2.6).
ALTER TABLE "audit_log" ADD COLUMN "entity_type" VARCHAR(50);
ALTER TABLE "audit_log" ADD COLUMN "entity_id" TEXT;
CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("entity_type", "entity_id");
