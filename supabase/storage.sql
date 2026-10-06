-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > Run.
-- Cria o bucket privado "planos" para o PDF do plano alimentar. Cada pessoa só enxerga a própria pasta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('planos', 'planos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "le o proprio plano" on storage.objects
  for select to authenticated
  using (bucket_id = 'planos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "envia o proprio plano" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'planos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "troca o proprio plano" on storage.objects
  for update to authenticated
  using (bucket_id = 'planos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'planos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "apaga o proprio plano" on storage.objects
  for delete to authenticated
  using (bucket_id = 'planos' and (storage.foldername(name))[1] = (select auth.uid())::text);
