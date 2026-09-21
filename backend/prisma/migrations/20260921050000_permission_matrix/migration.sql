-- 메뉴별 권한 (리뷰회의 1-7 · 5-18)
--
-- 「WB manager 사용권한 체크목록」(2026-09-19)의 본표를 그대로 옮긴다.
-- 화면 36개 × 계층 5개 × C·R·U·D. 값이 바뀌면 배포 없이 화면에서 고친다.
--
-- 표가 비어 있으면 지금과 똑같이 동작한다 — 값이 없다고 화면이 막히지 않게 하기 위해서다.

CREATE TABLE IF NOT EXISTS "permission_screen" (
  "key" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "memo" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_screen_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "permission" (
  "id" TEXT NOT NULL,
  "role_key" TEXT NOT NULL,
  "screen_key" TEXT NOT NULL,
  "can_create" BOOLEAN NOT NULL DEFAULT false,
  "can_read" BOOLEAN NOT NULL DEFAULT false,
  "can_update" BOOLEAN NOT NULL DEFAULT false,
  "can_delete" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "permission_role_screen_key" ON "permission"("role_key", "screen_key");

DO $$ BEGIN
  ALTER TABLE "permission" ADD CONSTRAINT "permission_screen_key_fkey"
    FOREIGN KEY ("screen_key") REFERENCES "permission_screen"("key") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 계정이 어느 계층인지. 기존 role(admin/worker)은 그대로 두어 관리자 판정이 깨지지 않게 한다.
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "role_key" TEXT;
UPDATE "app_user" SET "role_key" = CASE WHEN "role" = 'admin' THEN 'admin' ELSE 'staff' END WHERE "role_key" IS NULL;


-- 화면 36개
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('inbound','SWMS · 입출고','입고 현황',1,'직원 삭제는 당일 본인 등록분만 — 확정 필요',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('waste-inbound','SWMS · 입출고','폐기물 수집·운반 현황',2,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('outbound','SWMS · 입출고','출고 현황',3,'단가·금액 칸은 지정 사용자',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('waste-outbound','SWMS · 입출고','폐기물 반출 현황',4,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('prices.latest','SWMS · 단가','단가관리 · 최신단가 현황',5,'지정 사용자만 · 엑셀 내려받기 포함',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('prices.lookup','SWMS · 단가','단가관리 · 단가조회 · 추이',6,'이력 줄 고치기·지우기 포함',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('prices.entry','SWMS · 단가','단가관리 · 단가 입력',7,'지정 사용자만',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('prices.notice','SWMS · 단가','단가관리 · 공지 등록',8,'일괄반영·반영취소는 특수기능 표 참조',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('prices.lme','SWMS · 단가','단가관리 · LME 계산기',9,'다문산업 전용(검토의견 ⑥)',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('ledger','SWMS · 보고/평가/집계','통합 원장 조회',10,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('aggregation','SWMS · 보고/평가/집계','자동집계 현황',11,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('labor-plan','SWMS · 보고/평가/집계','현장인력계획',12,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('inventory','SWMS · 보고/평가/집계','재고 / 재고평가',13,'품목 추정단가 등록 포함',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('transports','SWMS · 보고/평가/집계','운반비 관리',14,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('labors','SWMS · 보고/평가/집계','공수표 관리',15,'일당·비용 칸은 지정 사용자',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('pnl','SWMS · 보고/평가/집계','손익보고서',16,'지정 사용자',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('daily-report','SWMS · 보고/평가/집계','출고보고서',17,'발행은 특수기능 표 참조',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('reports','SWMS · 보고/평가/집계','보고서 보관함',18,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('dms','DMS · 문서','문서 관리',19,'계약·증빙 — 분류별 제한이 필요한지 확인',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('projects','AMS · 현장 관리','프로젝트 관리',20,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('waste','AMS · 현장 관리','폐기물 / 올바로 관리',21,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('admin-alerts','AMS · 현장 관리','알림 현황',22,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('assets','AMS · 자산','자산 관리 (차량·장비)',23,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('employees','HRM · 임직원','임직원 관리',24,'개인정보 — 직원은 본인 정보만 볼지 확인',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.common-code','SYS · 마스터 관리','공통코드',25,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.vendor','SYS · 마스터 관리','거래처',26,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.item','SYS · 마스터 관리','품목',27,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.vehicle','SYS · 마스터 관리','계근 차량',28,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.driver','SYS · 마스터 관리','운전자',29,NULL,now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('master.vendor-item','SYS · 마스터 관리','업체품목 (단가)',30,'지정 사용자 · 엑셀 이관 포함',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('sys.change-log','SYS · 시스템 관리','최근 변경 로그',31,'구간 삭제는 관리자만',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('sys.users','SYS · 시스템 관리','사용자 승인 관리',32,'권한 변경 포함 — 관리자만',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('sys.audit','SYS · 시스템 관리','접속·변경 이력',33,'접속 IP 포함 — 관리자만',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('mobile.attend','모바일 · 휴대폰','출퇴근 (셀카 + 위치)',34,'본인 것만. 사무실 확인 후 정상등록',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('mobile.weigh','모바일 · 휴대폰','계근 등록 (모바일)',35,'현재 관리자 전용',now())
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "permission_screen" ("key","area","name","sort_order","memo","created_at")
VALUES ('gate','모바일 · 단말','출퇴근 단말 (QR)',36,'본사 단말 · 정규직만 찍힘',now())
ON CONFLICT ("key") DO NOTHING;

-- 계층별 권한 180줄 — 체크목록 본표 그대로
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','inbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','inbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','inbound',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','inbound',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','inbound',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','waste-inbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','waste-inbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','waste-inbound',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','waste-inbound',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','waste-inbound',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','outbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','outbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','outbound',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','outbound',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','outbound',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','waste-outbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','waste-outbound',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','waste-outbound',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','waste-outbound',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','waste-outbound',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','prices.latest',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','prices.latest',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','prices.latest',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','prices.latest',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','prices.latest',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','prices.lookup',false,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','prices.lookup',false,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','prices.lookup',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','prices.lookup',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','prices.lookup',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','prices.entry',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','prices.entry',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','prices.entry',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','prices.entry',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','prices.entry',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','prices.notice',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','prices.notice',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','prices.notice',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','prices.notice',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','prices.notice',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','prices.lme',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','prices.lme',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','prices.lme',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','prices.lme',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','prices.lme',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','ledger',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','ledger',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','ledger',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','ledger',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','ledger',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','aggregation',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','aggregation',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','aggregation',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','aggregation',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','aggregation',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','labor-plan',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','labor-plan',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','labor-plan',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','labor-plan',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','labor-plan',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','inventory',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','inventory',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','inventory',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','inventory',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','inventory',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','transports',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','transports',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','transports',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','transports',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','transports',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','labors',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','labors',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','labors',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','labors',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','labors',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','pnl',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','pnl',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','pnl',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','pnl',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','pnl',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','daily-report',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','daily-report',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','daily-report',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','daily-report',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','daily-report',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','reports',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','reports',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','reports',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','reports',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','reports',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','dms',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','dms',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','dms',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','dms',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','dms',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','projects',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','projects',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','projects',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','projects',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','projects',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','waste',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','waste',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','waste',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','waste',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','waste',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','admin-alerts',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','admin-alerts',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','admin-alerts',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','admin-alerts',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','admin-alerts',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','assets',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','assets',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','assets',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','assets',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','assets',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','employees',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','employees',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','employees',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','employees',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','employees',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.common-code',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.common-code',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.common-code',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.common-code',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.common-code',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.vendor',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.vendor',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.vendor',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.vendor',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.vendor',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.item',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.item',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.item',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.item',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.item',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.vehicle',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.vehicle',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.vehicle',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.vehicle',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.vehicle',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.driver',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.driver',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.driver',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.driver',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.driver',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','master.vendor-item',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','master.vendor-item',true,true,true,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','master.vendor-item',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','master.vendor-item',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','master.vendor-item',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','sys.change-log',false,true,false,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','sys.change-log',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','sys.change-log',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','sys.change-log',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','sys.change-log',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','sys.users',true,true,true,true,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','sys.users',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','sys.users',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','sys.users',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','sys.users',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','sys.audit',false,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','sys.audit',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','sys.audit',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','sys.audit',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','sys.audit',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','mobile.attend',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','mobile.attend',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','mobile.attend',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','mobile.attend',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','mobile.attend',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','mobile.weigh',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','mobile.weigh',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','mobile.weigh',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','mobile.weigh',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','mobile.weigh',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'admin','gate',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'operator','gate',true,true,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'staff','gate',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'viewer','gate',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
INSERT INTO "permission" ("id","role_key","screen_key","can_create","can_read","can_update","can_delete","updated_at")
VALUES (gen_random_uuid(),'field','gate',false,false,false,false,now())
ON CONFLICT ("role_key","screen_key") DO NOTHING;
