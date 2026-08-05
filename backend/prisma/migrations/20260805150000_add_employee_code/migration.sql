-- 임직원 고유코드(사번) — 근태 QR의 식별자로 쓴다.
ALTER TABLE "employee" ADD COLUMN "emp_code" TEXT;

-- 기존 임직원은 입사일(없으면 등록일) 연도 기준으로 소급 채번한다.
WITH numbered AS (
  SELECT
    id,
    to_char(COALESCE("hire_date", "created_at"), 'YYYY') AS yr,
    row_number() OVER (
      PARTITION BY to_char(COALESCE("hire_date", "created_at"), 'YYYY')
      ORDER BY COALESCE("hire_date", "created_at"), "created_at"
    ) AS seq
  FROM "employee"
)
UPDATE "employee" e
SET "emp_code" = 'EMP-' || n.yr || '-' || lpad(n.seq::text, 3, '0')
FROM numbered n
WHERE e.id = n.id;

CREATE UNIQUE INDEX "employee_emp_code_key" ON "employee"("emp_code");
