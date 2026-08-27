-- 차수 개념 삭제
-- 원방 업무에서는 한 계약을 차수로 쪼개 관리하지 않는다. 프로젝트(사업)명이 곧 식별자다.
-- 차수는 선택 입력 문자열이었고 다른 표가 참조하지 않아 컬럼만 지우면 된다.
ALTER TABLE "project" DROP COLUMN IF EXISTS "round_no";

-- 문서 분류 이름에서도 차수를 걷어낸다. 코드는 그대로라 자동 연계와 필수 분류 표시는 영향받지 않는다.
UPDATE "document_type" SET "name" = '프로젝트' WHERE "code" = 'DOC-02-01' AND "name" = '프로젝트(차수)';
UPDATE "document_type" SET "name" = '종료 정산서' WHERE "code" = 'DOC-02-01-004' AND "name" = '차수종료 정산서';
