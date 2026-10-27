-- 학점 계산기 초기 스키마
-- Supabase 대시보드의 SQL Editor에 통째로 붙여넣고 실행하면 됩니다.

-- ───────────── 학기 ─────────────
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year int not null check (year between 1900 and 2200),
  -- '1' 1학기, 'S' 여름 계절학기, '2' 2학기, 'W' 겨울 계절학기
  term text not null check (term in ('1', 'S', '2', 'W')),
  created_at timestamptz not null default now(),
  unique (user_id, year, term)
);

-- ───────────── 과목 ─────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  semester_id uuid not null references public.semesters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  -- 0.5학점 단위 과목도 있어서 소수 한 자리까지 허용
  credits numeric(3, 1) not null check (credits > 0 and credits <= 30),
  is_pf boolean not null default false,
  -- null 이면 아직 성적이 안 나온(수강 중) 과목
  grade text,
  created_at timestamptz not null default now(),
  -- P/F 과목은 P/NP만, 일반 과목은 등급만 들어가도록 강제
  constraint grade_matches_type check (
    grade is null
    or (is_pf and grade in ('P', 'NP'))
    or (not is_pf and grade in ('A+','A0','A-','B+','B0','B-','C+','C0','C-','D+','D0','D-','F'))
  )
);
create index courses_semester_idx on public.courses (semester_id);

-- ───────────── 노트 (마크다운 / 손필기) ─────────────
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null check (kind in ('markdown', 'drawing')),
  title text not null default '제목 없음' check (char_length(title) <= 200),
  content text not null default '',      -- 마크다운 본문
  drawing jsonb,                         -- 손필기 획 데이터 { version, pages: [{ strokes }] }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_course_idx on public.notes (course_id);

-- ───────────── 업로드 파일 메타데이터 ─────────────
create table public.course_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,                    -- 원래 파일명 (한글 가능)
  storage_path text not null unique,     -- 스토리지 키는 ASCII만 허용돼서 uuid로 저장
  size bigint not null,
  mime_type text,
  created_at timestamptz not null default now()
);
create index course_files_course_idx on public.course_files (course_id);

-- updated_at 자동 갱신
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- ───────────── RLS: 본인 데이터만 접근 ─────────────
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.notes enable row level security;
alter table public.course_files enable row level security;

create policy "own semesters" on public.semesters for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 남의 학기 id를 넣어서 과목을 끼워 넣지 못하도록 부모 소유권까지 확인
create policy "own courses" on public.courses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.semesters s where s.id = semester_id and s.user_id = (select auth.uid()))
  );

create policy "own notes" on public.notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid()))
  );

create policy "own files" on public.course_files for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.courses c where c.id = course_id and c.user_id = (select auth.uid()))
  );

-- ───────────── 스토리지: 비공개 버킷, 경로 첫 폴더 = 사용자 id ─────────────
-- 무료 플랜의 파일당 최대 크기가 50MB라서 그에 맞춤
insert into storage.buckets (id, name, public, file_size_limit)
values ('course-files', 'course-files', false, 52428800)
on conflict (id) do nothing;

create policy "own objects read" on storage.objects for select to authenticated
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own objects insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own objects delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
