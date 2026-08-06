-- 접속·변경 이력
ALTER TABLE "app_user" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "app_user" ADD COLUMN "last_login_ip" TEXT;
ALTER TABLE "app_user" ADD COLUMN "login_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "app_user_id" TEXT,
    "email" TEXT,
    "action" TEXT NOT NULL,
    "method" TEXT,
    "path" TEXT,
    "status_code" INTEGER,
    "ip" TEXT,
    "user_agent" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_app_user_id_fkey"
  FOREIGN KEY ("app_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");
