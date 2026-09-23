alter table favorites add column alias text
  check (alias is null or (length(alias) between 1 and 100));

create policy "update own favorites" on favorites
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update (alias) on favorites to authenticated;
