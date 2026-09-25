-- Protect dashboard data behind the single Supabase Auth operator account.
-- Create the operator account manually and set its app_metadata to
-- {"role":"stock_operator"} before using the dashboard. Do not use
-- user_metadata for authorization because users can edit that themselves.

grant usage on schema public to authenticated;

do $$
declare
  sequence_name regclass;
begin
  foreach sequence_name in array array[
    pg_get_serial_sequence('public.department_requests', 'id')::regclass,
    pg_get_serial_sequence('public.request_items', 'id')::regclass
  ] loop
    if sequence_name is not null then
      execute format(
        'grant usage, select on sequence %s to authenticated',
        sequence_name
      );
    end if;
  end loop;
end
$$;

-- Inventory is readable by the signed-in operator and editable from the app.
grant select on table
  public.psy_stock,
  public.ane_stock,
  public.mnl_stock
to authenticated;

grant update (
  description,
  category,
  unit,
  unit_price,
  ending_quantity,
  ending_amount
) on table public.psy_stock, public.ane_stock, public.mnl_stock
to authenticated;

revoke update on table
  public.psy_stock,
  public.ane_stock,
  public.mnl_stock
from anon, public;

revoke update (
  description,
  category,
  unit,
  unit_price,
  ending_quantity,
  ending_amount
) on table public.psy_stock, public.ane_stock, public.mnl_stock
from anon, public;

alter table public.psy_stock enable row level security;
alter table public.ane_stock enable row level security;
alter table public.mnl_stock enable row level security;

drop policy if exists "operator can read psy stock" on public.psy_stock;
create policy "operator can read psy stock"
  on public.psy_stock for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can update psy stock" on public.psy_stock;
create policy "operator can update psy stock"
  on public.psy_stock for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

drop policy if exists "operator can read ane stock" on public.ane_stock;
create policy "operator can read ane stock"
  on public.ane_stock for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can update ane stock" on public.ane_stock;
create policy "operator can update ane stock"
  on public.ane_stock for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

drop policy if exists "operator can read mnl stock" on public.mnl_stock;
create policy "operator can read mnl stock"
  on public.mnl_stock for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can update mnl stock" on public.mnl_stock;
create policy "operator can update mnl stock"
  on public.mnl_stock for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

-- Keep the request dashboard features available after authentication is added.
grant select on table public.departments to authenticated;
grant select, insert, update on table public.department_requests to authenticated;
grant select, insert on table public.request_items to authenticated;
grant select on table public.stock_items, public.categories to authenticated;
grant select on table public.request_items_analytics to authenticated;

alter table public.departments enable row level security;
alter table public.department_requests enable row level security;
alter table public.request_items enable row level security;
alter table public.stock_items enable row level security;
alter table public.categories enable row level security;

drop policy if exists "operator can read departments" on public.departments;
create policy "operator can read departments"
  on public.departments for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

drop policy if exists "operator can read department requests" on public.department_requests;
create policy "operator can read department requests"
  on public.department_requests for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can create department requests" on public.department_requests;
create policy "operator can create department requests"
  on public.department_requests for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can update department requests" on public.department_requests;
create policy "operator can update department requests"
  on public.department_requests for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

drop policy if exists "operator can read request items" on public.request_items;
create policy "operator can read request items"
  on public.request_items for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can create request items" on public.request_items;
create policy "operator can create request items"
  on public.request_items for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');

drop policy if exists "operator can read legacy stock items" on public.stock_items;
create policy "operator can read legacy stock items"
  on public.stock_items for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
drop policy if exists "operator can read legacy categories" on public.categories;
create policy "operator can read legacy categories"
  on public.categories for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'stock_operator');
