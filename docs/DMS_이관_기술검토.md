# Cross DMS → wbmanager 이관 기술 검토

작성일: 2026-08-18
대상: `C:\ProjectCode\Cross\cross\dms` (프론트) + `C:\ProjectCode\Cross\cross\functions` (백엔드 API)

---

## 1. 결론 요약

**화면(프론트)은 다시 만들고, 데이터 모델과 API는 wbmanager 방식으로 옮겨 붙이는 편이 빠릅니다.** 소스를 그대로 복사해 붙이는 방식은 두 시스템의 기반 기술이 층층이 달라 오히려 손이 더 많이 갑니다.

| 항목 | Cross DMS | wbmanager | 그대로 붙일 수 있나 |
|---|---|---|---|
| 서버 실행 | Firebase Functions Gen2 (CommonJS) | Cloud Run (ESM) | 불가 — 모듈 방식·배포 경로가 다름 |
| DB 접근 | `pg` 원시 SQL | Prisma ORM | 불가 — 스키마·마이그레이션 체계가 다름 |
| DB 인스턴스 | `crossmanager-480401:...:crossmanager` | `crosswb-a7083:...:wbmanager-db` | 불가 — 별도 인스턴스 |
| 파일 저장 | Firebase Storage + 로컬 `uploads/` | Google Drive (OAuth) | 불가 — 저장소를 하나로 정해야 함 |
| 인증 | 자체 `users` 테이블 + Firebase(선택) | Firebase 토큰 검증 + `app_user` 승인 | 불가 — 승인 체계가 다름 |
| 스타일 | 페이지별 CSS 파일 | Tailwind v4 + 공통 클래스 | 불가 — 화면 톤이 완전히 달라짐 |
| 상태/통신 | react-query + axios | 자체 `api` 래퍼(fetch) | 선택 — 하나로 통일 권장 |

이관 대상 규모는 DMS 프론트 약 **10,700줄**(페이지 16개, 컴포넌트 16개, 훅 10개)이고, 이 중 문서관리 핵심(`Documents.tsx` 548줄 + 업로드 모달 360줄 + 훅 59줄)이 약 **970줄**입니다.

---

## 2. 기능 범위 확인

DMS가 실제로 제공하는 것은 다음과 같습니다.

- **문서함** — 프로젝트별 폴더(카테고리) 생성·이름변경·삭제, 파일 업로드/다운로드, 우클릭 메뉴
- **버전 관리** — `documents.current_version` + `document_versions`(버전·파일경로·크기·해시·변경사유)
- **문서 속성** — 상태(DRAFT/APPROVED 등), 보안등급, 검토상태, 메타데이터(JSONB)
- 그 밖에 계약·일정(간트)·인원·자원·보고서·대시보드 화면이 같은 앱에 함께 있음

즉 "DMS 기능"이라 해도 실제로는 **문서함 + 버전관리**가 핵심이고, 나머지 화면은 wbmanager에 이미 있는 기능(프로젝트·보고서·자산·임직원)과 겹칩니다. 겹치는 화면까지 통째로 가져오면 메뉴가 이중화됩니다.

---

## 3. 기술적 문제점

### 3.1 서버 구동 방식이 다름 (중간)

Cross API는 Firebase Functions에 얹힌 Express이고(`functions/index.js` → `app.js`, `app.use('/api/documents', documentsRouter)`), 배포는 Hosting rewrite(`/api/** → function api`)로 연결됩니다. wbmanager는 Cloud Run에 컨테이너로 올라가는 독립 Express(ESM)입니다.

→ `routes/documents.js`는 CommonJS(`require`)라 그대로 넣으면 wbmanager 백엔드에서 로드되지 않습니다. 라우터 코드를 ESM으로 바꾸고, `pool`(pg) 대신 Prisma를 쓰도록 다시 써야 합니다.

### 3.2 DB가 Prisma 스키마 밖에 있음 (중간)

DMS의 `documents` / `document_versions` 테이블은 서버 부팅 시 `CREATE TABLE IF NOT EXISTS`로 만들어집니다(`functions/app.js` 563~600행). wbmanager는 Prisma 마이그레이션으로만 스키마를 바꾸고, 배포 파이프라인이 `prisma migrate deploy`를 돌립니다.

→ 같은 두 테이블을 **Prisma 스키마 모델로 새로 선언하고 마이그레이션 파일을 만들어야** 합니다. 부팅 시 DDL을 실행하는 방식은 wbmanager 규칙과 충돌하므로 가져오지 않는 것이 좋습니다.

### 3.3 프로젝트 식별자가 서로 다름 (높음)

DMS `documents.project_id`는 Cross DB의 프로젝트 UUID입니다. wbmanager의 `project`는 자체 UUID(`P-2026-001` 코드 별도)를 씁니다. 두 DB는 별개 인스턴스라 **기존 문서 데이터를 옮기려면 프로젝트 매핑표가 필요**합니다.

→ 기존 문서를 이관할 것인지, 신규부터 쌓을 것인지 먼저 정해야 합니다. 신규부터라면 이 문제는 사라집니다.

### 3.4 파일 저장소가 다름 (높음)

DMS는 Firebase Storage(`crossmanager-482403.appspot.com`) + Functions 로컬 `uploads/` 디렉터리를 함께 씁니다. wbmanager는 첨부를 **Google Drive**에 올리고 `attachment` 테이블에 `driveFileId`/`webViewLink`를 남깁니다(`backend/src/lib/drive.js`).

→ 셋 중 하나를 골라야 합니다.
1. wbmanager 방식(Drive)에 맞춰 문서 업로드도 Drive로 — 기존 첨부와 운영이 일원화됨. **권장**
2. wbmanager에 Firebase Storage를 새로 도입 — 저장소가 둘로 갈라짐
3. Cloud Run 로컬 디스크 — 컨테이너가 재시작하면 사라지므로 불가

또한 Cloud Run에는 Functions와 달리 쓰기 가능한 영구 로컬 디렉터리가 없으므로, `uploadsDir`를 쓰는 코드는 그대로 못 씁니다.

### 3.5 인증·권한 체계가 다름 (중간)

DMS는 Firebase 환경변수가 없으면 "샘플 모드"로 동작하고(`lib/firebase.ts`), API 클라이언트는 **토큰을 붙이지 않습니다**(`lib/api.ts`의 인터셉터가 TODO로 비어 있음). 반면 wbmanager는 모든 `/api`가 Firebase ID 토큰 검증 + 관리자 승인(`app_user.status === 'approved'`)을 통과해야 합니다.

→ 문서 API를 wbmanager로 옮기면 자동으로 인증이 걸립니다. 반대로 DMS 화면 코드를 그대로 쓰면 토큰이 없어 전부 401이 납니다. **API 호출부를 wbmanager의 `api` 래퍼로 바꿔야 합니다.**

문서 보안등급(`security_level`)에 따른 접근 제어는 DMS 쪽에도 구현이 없습니다. 필요하면 새로 설계해야 합니다.

### 3.6 화면 스타일이 다름 (중간)

DMS는 `Page.css`, `DMSDashboard.css` 같은 페이지 전용 CSS와 `.ctx-item` 같은 자체 클래스를 씁니다. wbmanager는 Tailwind v4 + `components/ui/classes.ts`의 공통 클래스(`cardCls`, `inputCls`, `thCls` …)로 톤을 맞춥니다.

→ CSS를 그대로 가져오면 wbmanager 안에서 혼자 다른 앱처럼 보입니다. 화면은 wbmanager 컴포넌트(FormModal, 테이블 클래스, Badge)로 다시 짜는 편이 결과가 낫고 작업량도 크게 다르지 않습니다.

### 3.7 의존성 추가 (낮음)

DMS는 `@tanstack/react-query`, `axios`, `jspdf`, `jspdf-autotable`, `html2canvas`를 씁니다. wbmanager에는 없습니다.

→ 문서함만 옮긴다면 react-query·axios 없이 기존 방식으로 충분합니다. PDF 출력이 필요하면 그때 `jspdf`만 추가하면 됩니다.

### 3.8 소스 상태 문제 (낮지만 선행 필요)

- `dms/package.json`에 **머지 충돌 표시가 그대로 남아 있습니다**(`<<<<<<< HEAD` / `>>>>>>> origin/main`). 지금 상태로는 `npm install`이 실패합니다.
- Cross `README.md`에 **운영 DB 접속정보(호스트·계정·비밀번호)가 평문으로 적혀 있습니다**. 이관 과정에서 이 값이 wbmanager 저장소로 옮겨 오지 않도록 주의해야 합니다.
- `functions/index.js.broken`, `patch_index.js` 등 정리되지 않은 파일이 섞여 있어, 어떤 코드가 실제 운영본인지 확인이 필요합니다.

---

## 4. 권장 이관 방식

**"화면은 다시, 데이터는 그대로"** 방식입니다.

| 단계 | 내용 | 예상 작업량 |
|---|---|---|
| 1 | Prisma에 `Document` / `DocumentVersion` 모델 추가 + 마이그레이션. `projectId`는 wbmanager `project`를 참조 | 0.5일 |
| 2 | 백엔드 `document.routes.js`(ESM+Prisma) — 목록·폴더·업로드·버전·삭제. 업로드는 기존 `uploadToDrive` 재사용 | 1~1.5일 |
| 3 | 프론트 `DocumentsPage` — wbmanager 공통 클래스로 폴더/파일 목록, 업로드 모달, 버전 이력 | 1.5~2일 |
| 4 | 메뉴 편입 — 업무영역에 `문서관리` 추가 또는 프로젝트 관리 하위로 | 0.5일 |
| 5 | (선택) 기존 문서 이관 — 프로젝트 매핑표 작성 후 파일 복사 + 메타데이터 이관 | 별도 산정 |

이 방식이면 인증·권한·배포·백업이 wbmanager 체계 하나로 유지되고, 운영 중 문제가 생겨도 추적 지점이 한 곳입니다.

---

## 5. 먼저 정해야 할 것

1. **범위** — 문서함(폴더+파일+버전)만인지, 계약·일정·인원 화면까지인지. 후자는 wbmanager 기존 기능과 겹칩니다
2. **기존 문서 이관 여부** — 신규부터 쌓으면 3.3(프로젝트 매핑)과 5단계가 통째로 빠집니다
3. **저장소** — Google Drive 일원화(권장) vs Firebase Storage 도입
4. **문서 권한** — 보안등급별 접근 제어가 필요한지. 필요하면 별도 설계가 선행되어야 합니다
