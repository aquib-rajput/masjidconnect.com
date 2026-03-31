-- 1. Enable Realtime for all core tables
-- This adds the tables to the 'supabase_realtime' publication
begin;
  -- Remove existing if needed (optional but safe)
  drop publication if exists supabase_realtime;
  
  -- Create publication with all necessary tables
  create publication supabase_realtime for table 
    public.posts, 
    public.profiles, 
    public.imams, 
    public.mosques, 
    public.prayer_times, 
    public.post_likes, 
    public.post_comments, 
    public.post_bookmarks,
    public.messages,
    public.message_reads,
    public.shura_members;
commit;

-- 2. Add new columns to the posts table safely (Idempotent)
do $$ 
begin 
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='posts' and column_name='post_type') then
        alter table public.posts add column post_type text default 'text';
    end if;
    
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='posts' and column_name='category') then
        alter table public.posts add column category text default 'general';
    end if;
    
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='posts' and column_name='metadata') then
        alter table public.posts add column metadata jsonb default '{}'::jsonb;
    end if;
end $$;

-- 3. Create public.post_bookmarks table safely
create table if not exists public.post_bookmarks (
    post_id uuid references public.posts(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (post_id, user_id)
);

-- 4. Enable RLS and Recreate Policies safely
alter table public.post_bookmarks enable row level security;

-- Drop existing policies first to avoid "already exists" errors
drop policy if exists "Users can view their own bookmarks" on public.post_bookmarks;
drop policy if exists "Users can insert their own bookmarks" on public.post_bookmarks;
drop policy if exists "Users can delete their own bookmarks" on public.post_bookmarks;

-- Create fresh policies
create policy "Users can view their own bookmarks"
    on public.post_bookmarks for select
    using (auth.uid() = user_id);

create policy "Users can insert their own bookmarks"
    on public.post_bookmarks for insert
    with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
    on public.post_bookmarks for delete
    using (auth.uid() = user_id);

-- 5. Create index safely
create index if not exists idx_post_bookmarks_user_id on public.post_bookmarks(user_id);

-- 6. Ensure RLS is enabled for posts and profiles too
alter table public.posts enable row level security;
alter table public.profiles enable row level security;

-- Example: Add a public select policy for posts if it doesn't exist
drop policy if exists "Allow public to view published posts" on public.posts;
create policy "Allow public to view published posts"
    on public.posts for select
    using (is_published = true or auth.uid() = author_id);
