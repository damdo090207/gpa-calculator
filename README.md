# 학점 계산기

학기별 학점 관리(4.3 만점, P/F 지원)와 과목별 필기(마크다운·손필기·파일 업로드)를 하는 웹앱입니다.
Next.js 16 + Supabase(DB·인증·스토리지) + Vercel 배포.

## 기능

- **학점**: 학기 추가 → 과목명·학점·P/F 여부·성적 입력. 학기 평점과 누적 평점 자동 계산
  - P/F 과목은 평점에서 빠지고, P일 때만 취득 학점에 들어갑니다
  - F는 평점 분모에 들어가고 취득 학점에서는 빠집니다
  - 성적을 '미정'으로 두면 수강 중 학점으로만 집계됩니다
- **노트** (과목별)
  - 마크다운: 편집 / 나란히 / 미리보기, 표·체크박스(GFM) 지원, 자동 저장
  - 손필기: 펜·형광펜·지우개, 필압 지원, 실행 취소, 줄/모눈/무지, 여러 쪽, '펜 전용' 모드(손바닥 터치 무시)
- **파일**: 과목별로 아무 형식이나 업로드(파일당 50MB), 이미지·PDF는 바로 보기
- **로그인**: 이메일 매직링크. 본인 데이터만 보이도록 DB·스토리지에 RLS 적용

## 처음 설정

### 1. Supabase

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **SQL Editor**에 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) 내용을 붙여넣고 실행
   (테이블·RLS 정책·`course-files` 비공개 버킷이 한 번에 만들어집니다)
3. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (처음엔 `http://localhost:3000`)
   - Redirect URLs에 추가: `http://localhost:3000/**`, 그리고 Vercel 배포 후 `https://<내-앱>.vercel.app/**`
4. **Project Settings → API Keys**에서 Project URL과 publishable key(또는 anon key) 복사

### 2. 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                   # http://localhost:3000
```

### 3. GitHub

```bash
gh auth login
gh repo create gpa-calculator --private --source . --push
```

### 4. Vercel

1. [vercel.com/new](https://vercel.com/new)에서 GitHub 저장소 Import
2. Environment Variables에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 입력 후 Deploy
3. 배포 주소를 Supabase Redirect URLs(위 1-3)에 추가

이후엔 `main` 브랜치에 push 할 때마다 Vercel이 자동으로 다시 배포합니다.

## 검증

```bash
npm test          # 평점 계산 단위 테스트 (vitest)
npm run lint
npm run build
```

수동 확인 체크리스트:
- 3학점 A+ + 2학점 B0 → 학기 평점 3.78
- P/F 과목 추가 시 평점은 그대로, 취득 학점만 증가
- 다른 계정으로 로그인하면 기존 계정의 학기·노트·파일이 보이지 않음

## 구조

```
src/
  proxy.ts                         세션 갱신 + 비로그인 시 /login 이동 (Next 16의 middleware)
  lib/gpa.ts                       평점 계산 (정수 연산으로 부동소수점 오차 방지)
  lib/supabase/{client,server}.ts  Supabase 클라이언트
  lib/useAutosave.ts               노트 자동 저장 훅
  app/page.tsx                     학기·과목 대시보드
  app/courses/[id]/                과목 상세 (노트 목록, 파일)
  app/courses/[id]/notes/[noteId]/ 노트 편집
  components/                      UI 컴포넌트 (DrawingEditor = 손필기 캔버스)
supabase/migrations/               DB 스키마
```
