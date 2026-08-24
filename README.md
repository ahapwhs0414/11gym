# 헬스장 직감 관리 시스템 (Phase 1)

힘레븐1 / 힘레븐2 직감 배정 및 관리 시스템입니다. 현재 이 저장소는 **Phase 1**까지 구현되어 있습니다.

## Phase 1에서 구현된 것

- Next.js(App Router) + TypeScript + Tailwind 프로젝트 뼈대
- Prisma 스키마 전체 정의 (앞으로의 Phase에서 바로 이어 쓸 수 있도록 전체 테이블 포함, 실제 사용은 `User`/`Gym`/`ChecklistItem`부터 시작)
- 일반 사용자 로그인 (`이름 + 4자리 PIN`, bcrypt 해시)
- 관리자 로그인 (`아이디 + 비밀번호`, 사용자와 분리된 인증 경로)
- 세션 기반 인증(iron-session, httpOnly 쿠키) + 미들웨어 기반 권한 분리(`/admin/*`는 관리자만, 그 외 보호 페이지는 로그인 사용자만)
- 로그인 시도 제한(5분 내 5회 실패 시 잠금)
- 관리자 대시보드 / 사용자 홈 화면 뼈대 (DB에서 사용자 수를 읽어와 실제 연결 확인 가능)

아직 없는 것(다음 Phase 예정): 사용자 관리 화면, PIN 변경, 헬스장 선호도 설정, 투표, 자동 배정, 교환, 출석/체크리스트, 통계, PWA 등.

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
- `CRON_SECRET`: 아무 랜덤 문자열 (Phase 4에서 사용 예정, 지금 미리 넣어둬도 무방)

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

이후 GitHub `main` 브랜치에 push할 때마다 Vercel이 자동으로 재배포합니다.

---

## 3. 참고: 이 코드가 만들어진 환경의 제약

이 코드는 네트워크가 제한된 개발 환경에서 작성되어 `prisma generate`(엔진 바이너리 다운로드)를 이 환경에서 직접 검증하지 못했습니다. 일반 PC나 Vercel 빌드 환경은 제한이 없으므로 `npm install` 시 정상적으로 다운로드됩니다. ESLint 및 코드 구조 검증은 완료했습니다.

---

## 4. 다음 단계 (Phase 2)

- 관리자 화면에서 사용자 생성/비활성화/PIN 초기화
- 사용자 본인 PIN 변경
- 헬스장 선호도 설정
- 관리자 비밀번호 변경 기능 (지금은 시드로만 설정 가능)

Phase 2로 진행하려면 "Phase 2 진행해줘"라고 요청해주세요.
