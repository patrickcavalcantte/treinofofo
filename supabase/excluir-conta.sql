-- Rode este arquivo uma vez no Supabase: SQL Editor > New query > Run.
-- Permite que cada pessoa exclua a própria conta pelo app. O PDF do plano alimentar é apagado pelo app
-- antes desta chamada, porque o Supabase não deixa apagar arquivos do Storage direto por SQL.
-- A linha de app_state some junto (on delete cascade em auth.users).

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
