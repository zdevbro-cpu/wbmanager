-- 발행한 보고서 보관 (일일 출고보고 / 손익보고)
CREATE TABLE "report" (
    "id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "project_id" TEXT,
    "report_date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "report" ADD CONSTRAINT "report_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "report_report_date_idx" ON "report"("report_date");
