create or replace view public.request_items_analytics
with (security_invoker = true) as
select
  ri.id as request_item_id,
  dr.id as request_id,
  dr.reference_number,
  dr.release_reference_number,
  dr.clinic_id,
  case
    when dr.clinic_id = 'pasay'::text then 'Pasay'::text
    when dr.clinic_id = any (array['ane'::text, 'ani'::text]) then 'ANE'::text
    when dr.clinic_id = 'manila'::text then 'Manila'::text
    else dr.clinic_id
  end as clinic_name,
  d.name as department_name,
  dr.receiver_name,
  dr.status,
  dr.remarks,
  dr.created_at as requested_at,
  dr.approved_at,
  dr.completed_at,
  coalesce(ri.branch_stock_id, ri.stock_item_id) as stock_item_id,
  coalesce(psy.item_id, ane.item_id, mnl.item_id, legacy.id::text) as item_code,
  coalesce(psy.description, ane.description, mnl.description, legacy.item_name::text) as item_name,
  coalesce(psy.category, ane.category, mnl.category, cat.name::text) as category,
  ri.unit,
  ri.requested_quantity,
  coalesce(
    psy.ending_quantity,
    ane.ending_quantity,
    mnl.ending_quantity::numeric,
    legacy.quantity::numeric
  ) as current_stock,
  coalesce(psy.unit_price, ane.unit_price, mnl.unit_price, 0::numeric) as unit_price,
  ri.requested_quantity::numeric * coalesce(
    psy.unit_price,
    ane.unit_price,
    mnl.unit_price,
    0::numeric
  ) as requested_amount
from public.request_items ri
join public.department_requests dr on dr.id = ri.request_id
left join public.departments d on d.id = dr.department_id
left join public.psy_stock psy
  on dr.clinic_id = 'pasay'::text
  and psy.id = ri.branch_stock_id
left join public.ane_stock ane
  on dr.clinic_id = any (array['ane'::text, 'ani'::text])
  and ane.id = ri.branch_stock_id
left join public.mnl_stock mnl
  on dr.clinic_id = 'manila'::text
  and mnl.id = ri.branch_stock_id
left join public.stock_items legacy on legacy.id = ri.stock_item_id
left join public.categories cat on cat.id = legacy.category_id;
