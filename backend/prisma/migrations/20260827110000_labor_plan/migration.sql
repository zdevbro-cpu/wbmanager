-- 인력투입계획 — 프로젝트 아래에 "어느 구간에 어떤 고용구분을 하루 몇 공수 쓸지"를 잡는다.
-- 사람을 지목하지 않는다. 한 사람이 여러 프로젝트를 도는 현장에서는
-- "누가"보다 "며칠 몇 공수"가 원가에 맞는 단위이기 때문이다.
CREATE TABLE "labor_plan" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "employment_type" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "man_days" DECIMAL(8,3) NOT NULL,
    "unit_cost" DECIMAL(14,2),
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_plan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "labor_plan_project_id_idx" ON "labor_plan"("project_id");
CREATE INDEX "labor_plan_start_date_idx" ON "labor_plan"("start_date");

ALTER TABLE "labor_plan" ADD CONSTRAINT "labor_plan_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
