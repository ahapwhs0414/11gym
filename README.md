# 헬스장 직감 관리 시스템 (Phase 8)

힘레븐1 / 힘레븐2 직감 배정 및 관리 시스템입니다. 현재 이 저장소는 **Phase 8**까지 구현되어 있습니다.

## Phase 1에서 구현된 것

- Next.js(App Router) + TypeScript + Tailwind 프로젝트 뼈대
- Prisma 스키마 전체 정의 (앞으로의 Phase에서 바로 이어 쓸 수 있도록 전체 테이블 포함, 실제 사용은 `User`/`Gym`/`ChecklistItem`부터 시작)
- 일반 사용자 로그인 (`이름 + 4자리 PIN`, bcrypt 해시)
- 관리자 로그인 (`아이디 + 비밀번호`, 사용자와 분리된 인증 경로)
- 세션 기반 인증(iron-session, httpOnly 쿠키) + 미들웨어 기반 권한 분리(`/admin/*`는 관리자만, 그 외 보호 페이지는 로그인 사용자만)
- 로그인 시도 제한(5분 내 5회 실패 시 잠금)
- 관리자 대시보드 / 사용자 홈 화면 뼈대 (DB에서 사용자 수를 읽어와 실제 연결 확인 가능)

## Phase 2에서 구현된 것

- 관리자 화면에서 사용자 생성 / 비활성화·재활성화 / PIN 초기화 (`/admin/users`)
- 사용자 본인 PIN 변경 (`/settings`)
- 헬스장 선호도 설정 (힘레븐1 / 힘레븐2 / 상관없음)
- 관리자 비밀번호 변경 (`/admin/password`)
- 관리자의 사용자 관련 변경사항 감사 로그 기록

## Phase 3에서 구현된 것

- `src/lib/duty-week.ts`: "현재 투표 대상 주"(항상 마감 전인 가장 빠른 다음 주)와 금요일 21:00(KST)
  마감 시각을 계산하는 로직, 해당 주의 직감 슬롯(평일 1개, 주말 3개 × 2일 = 총 11개) 자동 생성
- 사용자 직감 가능 시간 투표 화면 (`/availability`): 슬롯별 토글, 기본값 전부 불가능, "이번 주에는
  모든 시간에 직감을 설 수 없습니다" 일괄 체크
- `POST /api/availability`: 대상 주/마감을 서버에서 다시 계산해 검증(클라이언트 값 신뢰 안 함),
  마감 후에는 거부, 슬롯당 `Availability` upsert
- 홈 화면에 "다음 주 직감 가능 시간 투표" 바로가기 카드 추가

## Phase 4에서 구현된 것

- `src/lib/assignment/fairness-engine.ts`: DB/Next.js에 의존하지 않는 순수 배정 알고리즘.
  명세서 §19-31의 우선순위(횟수 균등화 → 희소 가능자 보호 → 헬스장 선호도 → 최근 배정일 → 랜덤)를
  그대로 구현하며, 재실행 시 이미 채워진 자리는 건드리지 않고 빈 자리만 채운다(idempotent).
- `src/lib/assignment/run-weekly-assignment.ts`: 실제 DB에서 사용자/가용성/이력을 읽어 위 엔진에
  넘기고 결과를 트랜잭션으로 저장하는 I/O 레이어.
- `GET /api/cron/weekly-assignment`: `vercel.json`에 등록된 Vercel Cron(매주 금요일 12:00 UTC =
  21:00 KST)이 호출, `CRON_SECRET`으로 인증.
- `POST /api/admin/assignments/run`: 명세서 §17의 "시스템 오류 시 관리자 수동 배정" 경로. 관리자
  세션 필요, 실행 내역을 감사 로그에 기록.
- 배정 결과 검증(각 슬롯 힘레븐1/2 각 1명, 동일 날짜 중복 없음)과 미배정 슬롯 처리(§74-76): 후보가
  부족하면 임의로 중복 배정하지 않고 해당 슬롯을 `UNDERSTAFFED`로 표시.

## Phase 5에서 구현된 것

- 사용자 홈 화면에 "다음 직감" 위젯 (가장 가까운 예정 배정을 바로 표시)
- 사용자 "내 전체 일정" 화면 (`/schedule`): 목록 보기(다가오는 일정 / 지난 일정)와 캘린더 보기(월
  단위, 이전/다음 달 이동) 두 가지 표시 방식 지원, 과거·현재·미래 일정을 모두 확인 가능
- 관리자 "직감 전체 일정" 화면 (`/admin/schedule`): 명세서 §36 표 형식(날짜/시간/힘레븐1/힘레븐2/상태),
  이전/다음 주 이동, 슬롯이 아직 생성되지 않은 주도 예상 시간표를 보여줌(투표/배정 전 상태 확인용)

## Phase 6에서 구현된 것

- `src/lib/exchange.ts`: 직감 교환 생성/수락/거절/취소 로직. 명세서 §40의 검증(활성 계정, 해당 시간
  가능 여부, 동일 날짜 중복 방지)을 수락 시점에 다시 확인하며, 전체를 트랜잭션으로 처리한다.
- 단방향(양도)과 양방향(교환) 모두 지원. 양방향은 두 배정의 `userId`를 서로 맞바꾼다.
- `/exchanges` 화면: 받은 요청(수락/거절), 보낸 요청(취소), 새 요청 만들기(대체자·교환 방식·사유 선택)
- `POST /api/exchanges`, `POST /api/exchanges/[id]/accept|reject|cancel` — 관리자 승인 없이 당사자 간
  자동 처리, 변경 이력은 `AssignmentHistory`에 저장(원래 배정자·변경 배정자·변경 방식 보관)
- 홈 화면에 받은 교환 요청 개수 표시

## Phase 7에서 구현된 것

- `DutyLog` 스키마 조정: 출석(정상/지각)과 퇴근(정상/조기)은 서로 독립적인 사실이라 `status` 하나로
  표현할 수 없어(§50 참고), `status`(SCHEDULED/COMPLETED/ABSENT)와 `startedLate`/`endedEarly`
  boolean을 분리했다 (마이그레이션 `duty_log_attendance_flags`, 기존 데이터 없어 안전하게 적용).
- `src/lib/duty-log.ts`: 시작/체크리스트/종료/결석처리 상태 전이 로직.
  - 시작 시각이 예정 시각 + 5분(관리자 설정 화면 도입 전까지의 기본 유예시간)을 넘으면 지각으로 기록.
  - 필수 체크리스트를 모두 완료해야 종료할 수 있고(서버에서 재검증), 종료 시각이 예정보다 빠르면
    조기 종료로 기록.
  - 관리자는 출석 기록이 없는 지난 배정을 결석으로 표시할 수 있음(이미 출석한 건은 불가).
- `/duty/[assignmentId]` 화면: 직감 시작/체크리스트/직감 종료 버튼, 홈 화면과 내 전체 일정에서 연결.
- 관리자 전체 일정(`/admin/schedule`)에 출석/지각/종료/조기/결석 표시와 결석 처리 버튼 추가.

## Phase 8에서 구현된 것

- `SystemSetting`(key-value) 모델 추가: 지각 판정 유예 시간(§44)을 코드 상수 대신 관리자 화면
  (`/admin/settings`)에서 조정할 수 있다. `src/lib/settings.ts`가 기본값(5분)과 조회/저장을 담당한다.
- 공지사항(§57): 관리자 작성/중요표시/삭제(`/admin/notices`), 사용자 열람(`/notices`), 중요 공지는
  홈 화면 상단에 배너로 노출.
- 의견 제시(§55-56): 사용자 제출(익명 옵션, `/complaints`), 관리자 상태 변경(접수/확인 중/처리 완료)과
  답변 작성(`/admin/complaints`, 상태별 필터).
- 감사 로그 조회(§73, `/admin/audit-logs`): 대상 유형별 필터와 페이지네이션.
- 월간 관리자 기록(§49-50, §80-82, `/admin/monthly`): 연/월 이동, 사용자·헬스장·출석상태 필터,
  월간 전체 통계(§52) 카드, CSV 내보내기(`/api/admin/monthly/export`). 계산 로직은
  `src/lib/monthly-report.ts`에 순수 함수로 분리해 페이지와 CSV 라우트가 공유한다.
- 직감 공평성 통계(§53, `/admin/statistics`): 주 단위 가능 슬롯/배정 횟수/배정률과 전체 기간 누적
  최근 직감일·헬스장별 배정 횟수.
- 관리자용 사용자 상세(§83, `/admin/users/:id`): 월별 직감/정상출석/지각/결석/조기종료/교환/헬스장별
  횟수와 그 달의 직감 목록, 관리자 내부 메모(§88, 일반 사용자에게 비공개) 편집.
- 관리자 대시보드 확장(§54, §85, §86): 이번 주 직감자·지각·결석·체크리스트 미완료, 다음 주 직감자·
  투표 미제출자·전체 불가능 체크·미배정 슬롯, 이번 주 교환 완료, 다음 주 배정 위험도(가능 후보 수 기준
  안정/주의/위험) 표시.
- 인앱 알림(§58 일부, `Notification` 모델 활용): 자동 배정 완료 시 배정된 사용자 전원에게, 교환 요청
  생성 시 대체자에게 알림 생성. `/notifications`에서 목록 확인·읽음 처리, 홈 화면에 안읽음 개수 표시.
  실제 푸시 발송은 Phase 9(PWA)에서 확장한다.
- 투표 조기 마감(§15 확장, `/admin/voting`): 정규 마감(금요일 21:00) 전에도 관리자가 즉시 투표를
  마감하고 그 자리에서 자동 배정을 실행할 수 있다. `VotingClosure` 모델에 마감 기록을 남기고, 마감된
  주는 사용자 투표 화면에서 읽기 전용으로 표시된다. "재오픈" 시 마감 기록만 취소되며 이미 생성된 배정은
  유지된다(§17 idempotent 배정과 동일하게, 추가 투표 반영은 배정을 다시 실행해서 처리).
- 직감 종료 시 선택 입력 문제/건의 사항(`DutyLog.issueNote`): 필수 체크리스트와 별개로, 직감 중
  발생한 문제나 건의할 내용을 자유 서술형으로 남길 수 있다(작성하지 않아도 종료 가능). 관리자는
  월간 직감 기록(`/admin/monthly`)과 사용자 상세(`/admin/users/:id`), CSV 내보내기에서 확인할 수 있다.

## 추가 기능: 주말형 일정 (공휴일 등)

- 평일도 공휴일 등 특별한 사정으로 주말처럼 3타임이 필요할 수 있다는 요구사항을 명세서 §3.3에 추가.
- `special_schedule_days` 테이블(관리자가 지정한 날짜 목록) + `src/lib/duty-week.ts`의
  `getWeekendPatternDates`/`getDaySlotTimes`로 슬롯 생성·조회 로직이 이 지정을 반영하도록 구현.
- 이미 슬롯이 생성된 날짜에 나중에 지정해도 기존 슬롯은 유지되고 나머지 2타임만 추가된다(파괴적이지 않음).
- 관리자 화면 `/admin/special-days`에서 지정/해제 (감사 로그 기록).

아직 없는 것(다음 Phase 예정): PWA(Web App Manifest, Service Worker, 오프라인 캐싱, 설치, 푸시 알림).

---

## 1. 로컬에서 실행하기

### 1-1. 요구 사항
- Node.js 20 이상
- Supabase 계정 (무료)

### 1-2. 설치
```bash
npm install
```
> `npm install` 시 `postinstall` 스크립트가 자동으로 `prisma generate`를 실행합니다.

### 1-3. Supabase 프로젝트 생성 & 연결 정보 확인
1. https://supabase.com 에서 새 프로젝트 생성 (무료 플랜, 카드 등록 불필요)
2. 프로젝트 생성 후 **Project Settings → Database** 이동
3. **Connection string** 섹션에서:
   - `Transaction pooler` (포트 6543) 문자열 → `.env`의 `DATABASE_URL`
   - `Session pooler` 또는 `Direct connection` (포트 5432) 문자열 → `.env`의 `DIRECT_URL`

### 1-4. 환경 변수 설정
```bash
cp .env.example .env
```
`.env` 파일을 열어 아래 값을 채웁니다.
- `DATABASE_URL`, `DIRECT_URL`: 위에서 복사한 Supabase 연결 문자열
- `SESSION_SECRET`: `openssl rand -base64 32` 명령으로 생성한 랜덤 문자열
- `CRON_SECRET`: 아무 랜덤 문자열 (Vercel Cron이 `/api/cron/weekly-assignment` 호출 시 인증에 사용)

### 1-5. 데이터베이스 마이그레이션 + 초기 데이터 생성
```bash
npx prisma migrate dev --name init
npm run db:seed
```

`db:seed`를 실행하면 다음이 자동 생성됩니다.
- 헬스장 2곳(힘레븐1, 힘레븐2)
- 체크리스트 기본 항목 4개
- **관리자 계정** (기본값: 아이디 `admin` / 비밀번호 `changeme123!`)
  - 다른 값을 쓰고 싶다면 `.env`에 `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`를 추가하고 다시 시드하세요.
  - ⚠️ **운영 배포 전 반드시 관리자 비밀번호를 바꾸세요.** (비밀번호 변경 기능은 Phase 2에서 추가됩니다. 그 전까지는 시드 값을 강력한 문자열로 바꿔서 재시드하는 방식으로 대응하세요.)
- (선택) 테스트 사용자 계정: `.env`에 `SEED_WITH_TEST_USER=true`를 추가하고 시드하면 `테스트유저 / PIN 1234` 계정이 생성됩니다. **로컬 개발용이며 운영 배포 시에는 추가하지 마세요.**

### 1-6. 개발 서버 실행
```bash
npm run dev
```
- 사용자 로그인: http://localhost:3000/login
- 관리자 로그인: http://localhost:3000/admin-login

---

## 2. 무료로 배포하기 (Vercel + Supabase)

1. **GitHub 저장소 만들기**: 이 프로젝트를 GitHub에 push합니다.
   ```bash
   git init
   git add .
   git commit -m "Phase 1: 프로젝트 뼈대, DB, 로그인/권한"
   git branch -M main
   git remote add origin <내-깃허브-저장소-URL>
   git push -u origin main
   ```
2. **Vercel 프로젝트 생성**: https://vercel.com → New Project → 방금 만든 GitHub 저장소 선택 (무료 Hobby 플랜, 카드 등록 불필요)
3. **환경 변수 등록**: Vercel 프로젝트 → Settings → Environment Variables에 `.env`의 값들을 그대로 등록
   - `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `CRON_SECRET`
4. **첫 배포 후 마이그레이션 적용**: 배포가 끝나면 로컬 터미널에서 프로덕션 DB에 대해 한 번 실행합니다.
   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```
   (로컬 `.env`가 이미 Supabase 프로덕션 DB를 가리키고 있으므로 별도 설정 없이 실행하면 됩니다.)
5. 배포된 URL로 접속해 `/admin-login`, `/login`이 정상 동작하는지 확인합니다.
6. `vercel.json`에 정의된 Cron(매주 금요일 12:00 UTC = 21:00 KST, `/api/cron/weekly-assignment`)은
   Vercel Hobby(무료) 플랜에서도 동작합니다. Vercel 프로젝트 → Settings → Cron Jobs에서 등록 여부를
   확인하세요.

이후 GitHub `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포합니다.

---

## 3. 참고: 이 코드가 만들어진 환경의 제약

이 코드는 네트워크가 제한된 개발 환경에서 작성되어 `prisma generate`(엔진 바이너리 다운로드)를 이 환경에서 직접 검증하지 못했습니다. 일반 PC나 Vercel 빌드 환경은 제한이 없으므로 `npm install` 시 정상적으로 다운로드됩니다. ESLint 및 코드 구조 검증은 완료했습니다.

---

## 4. 다음 단계 (Phase 9)

- PWA: Web App Manifest, Service Worker, 설치 가능, 모바일 홈 화면 실행, 기본 오프라인 캐싱,
  푸시 알림으로 확장 가능한 구조.
