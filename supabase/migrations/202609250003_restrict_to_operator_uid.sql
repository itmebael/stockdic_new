-- Restrict the policies created by 202609250002 to the single operator account.
-- This also updates installations that already applied migration 002.

drop policy if exists "operator can read psy stock" on public.psy_stock;
create policy "operator can read psy stock"
  on public.psy_stock for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can update psy stock" on public.psy_stock;
create policy "operator can update psy stock"
  on public.psy_stock for update to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid)
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read ane stock" on public.ane_stock;
create policy "operator can read ane stock"
  on public.ane_stock for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can update ane stock" on public.ane_stock;
create policy "operator can update ane stock"
  on public.ane_stock for update to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid)
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read mnl stock" on public.mnl_stock;
create policy "operator can read mnl stock"
  on public.mnl_stock for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can update mnl stock" on public.mnl_stock;
create policy "operator can update mnl stock"
  on public.mnl_stock for update to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid)
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read departments" on public.departments;
create policy "operator can read departments"
  on public.departments for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read department requests" on public.department_requests;
create policy "operator can read department requests"
  on public.department_requests for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can create department requests" on public.department_requests;
create policy "operator can create department requests"
  on public.department_requests for insert to authenticated
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can update department requests" on public.department_requests;
create policy "operator can update department requests"
  on public.department_requests for update to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid)
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read request items" on public.request_items;
create policy "operator can read request items"
  on public.request_items for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can create request items" on public.request_items;
create policy "operator can create request items"
  on public.request_items for insert to authenticated
  with check (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);

drop policy if exists "operator can read legacy stock items" on public.stock_items;
create policy "operator can read legacy stock items"
  on public.stock_items for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
drop policy if exists "operator can read legacy categories" on public.categories;
create policy "operator can read legacy categories"
  on public.categories for select to authenticated
  using (auth.uid() = '5dbce11b-a2ee-405f-9aba-06c127e52e1c'::uuid);
