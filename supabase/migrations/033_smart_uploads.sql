-- Smart Uploads: uploaded documents, normalized knowledge facts, and an
-- embeddings table for the future semantic-retrieval provider abstraction
-- (lib/embeddings/). Mirrors the RLS/trigger shape of
-- 032_google_search_console.sql.

create table if not exists public.smart_upload_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  file_name text not null,
  file_type text not null
    check (file_type in ('pdf', 'docx', 'txt', 'markdown', 'powerpoint', 'excel', 'image', 'csv')),
  storage_path text not null,
  file_size_bytes integer not null default 0,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'extracted', 'failed')),
  extraction_error text,
  fact_count integer not null default 0,
  uploaded_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists smart_upload_documents_user_id_idx on public.smart_upload_documents (user_id);
create index if not exists smart_upload_documents_business_profile_id_idx
  on public.smart_upload_documents (business_profile_id);
create index if not exists smart_upload_documents_status_idx on public.smart_upload_documents (status);
create index if not exists smart_upload_documents_created_at_idx
  on public.smart_upload_documents (created_at desc);

alter table public.smart_upload_documents enable row level security;

create policy "Users can view own smart upload documents"
  on public.smart_upload_documents for select using (auth.uid() = user_id);
create policy "Users can insert own smart upload documents"
  on public.smart_upload_documents for insert with check (auth.uid() = user_id);
create policy "Users can update own smart upload documents"
  on public.smart_upload_documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own smart upload documents"
  on public.smart_upload_documents for delete using (auth.uid() = user_id);

-- Normalized, reusable business knowledge extracted from documents — the
-- actual point of this feature. Never raw AI summaries.
create table if not exists public.smart_upload_knowledge_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  document_id uuid not null references public.smart_upload_documents (id) on delete cascade,
  category text not null check (category in (
    'product', 'service', 'pricing', 'target_customer', 'geographic_market',
    'unique_selling_point', 'competitive_advantage', 'seasonal_offering', 'faq',
    'terminology', 'guarantee', 'certification', 'industry_served',
    'call_to_action', 'brand_voice', 'important_date'
  )),
  fact text not null,
  source_excerpt text,
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  date_learned timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  superseded_by uuid references public.smart_upload_knowledge_facts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists smart_upload_knowledge_facts_user_id_idx
  on public.smart_upload_knowledge_facts (user_id);
create index if not exists smart_upload_knowledge_facts_business_profile_id_idx
  on public.smart_upload_knowledge_facts (business_profile_id);
create index if not exists smart_upload_knowledge_facts_document_id_idx
  on public.smart_upload_knowledge_facts (document_id);
create index if not exists smart_upload_knowledge_facts_category_idx
  on public.smart_upload_knowledge_facts (category);
create index if not exists smart_upload_knowledge_facts_lookup_idx
  on public.smart_upload_knowledge_facts (business_profile_id, superseded_by);

alter table public.smart_upload_knowledge_facts enable row level security;

create policy "Users can view own smart upload knowledge facts"
  on public.smart_upload_knowledge_facts for select using (auth.uid() = user_id);
create policy "Users can insert own smart upload knowledge facts"
  on public.smart_upload_knowledge_facts for insert with check (auth.uid() = user_id);
create policy "Users can update own smart upload knowledge facts"
  on public.smart_upload_knowledge_facts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own smart upload knowledge facts"
  on public.smart_upload_knowledge_facts for delete using (auth.uid() = user_id);

-- Embeddings for future semantic retrieval (lib/embeddings/ provider
-- abstraction). Provider-agnostic: `provider_id` + `dimensions` let a future
-- provider swap (e.g. a different embedding model) coexist with rows from an
-- older provider without a migration.
create extension if not exists vector;

create table if not exists public.smart_upload_fact_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid not null references public.business_profiles (id) on delete cascade,
  fact_id uuid not null references public.smart_upload_knowledge_facts (id) on delete cascade,
  provider_id text not null,
  dimensions integer not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (fact_id, provider_id)
);

create index if not exists smart_upload_fact_embeddings_user_id_idx
  on public.smart_upload_fact_embeddings (user_id);
create index if not exists smart_upload_fact_embeddings_fact_id_idx
  on public.smart_upload_fact_embeddings (fact_id);

alter table public.smart_upload_fact_embeddings enable row level security;

create policy "Users can view own smart upload fact embeddings"
  on public.smart_upload_fact_embeddings for select using (auth.uid() = user_id);
create policy "Users can insert own smart upload fact embeddings"
  on public.smart_upload_fact_embeddings for insert with check (auth.uid() = user_id);
create policy "Users can delete own smart upload fact embeddings"
  on public.smart_upload_fact_embeddings for delete using (auth.uid() = user_id);

create or replace function public.set_smart_upload_documents_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.set_smart_upload_knowledge_facts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists smart_upload_documents_updated_at on public.smart_upload_documents;
create trigger smart_upload_documents_updated_at
  before update on public.smart_upload_documents
  for each row execute function public.set_smart_upload_documents_updated_at();

drop trigger if exists smart_upload_knowledge_facts_updated_at on public.smart_upload_knowledge_facts;
create trigger smart_upload_knowledge_facts_updated_at
  before update on public.smart_upload_knowledge_facts
  for each row execute function public.set_smart_upload_knowledge_facts_updated_at();

-- Private storage bucket for uploaded document originals — never public.
-- Original files are kept (not just extracted text) so "view uploaded
-- documents" and "reprocess documents" (re-run extraction) both work.
insert into storage.buckets (id, name, public)
values ('smart-uploads', 'smart-uploads', false)
on conflict (id) do nothing;

-- Objects are stored at `{auth.uid()}/{document_id}/{file_name}` — the first
-- path segment is checked against the caller's own uid so RLS never depends
-- on the caller supplying a business_profile_id.
create policy "Users can upload own smart upload files"
  on storage.objects for insert
  with check (bucket_id = 'smart-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own smart upload files"
  on storage.objects for select
  using (bucket_id = 'smart-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own smart upload files"
  on storage.objects for delete
  using (bucket_id = 'smart-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
