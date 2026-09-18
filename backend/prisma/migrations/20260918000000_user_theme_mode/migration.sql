-- 화면 모드 — 사람마다 고른 모드를 계정에 남긴다. 어느 기기에서 들어와도 같은 모드로 열린다.
-- dark(어두운 청색) | light(밝게) | system(기기 설정 따름). 지금까지의 화면이 dark라 기본값도 dark로 둔다.
ALTER TABLE "app_user" ADD COLUMN "theme_mode" TEXT NOT NULL DEFAULT 'dark';
