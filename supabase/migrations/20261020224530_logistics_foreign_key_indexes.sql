create index logistics_admin_events_actor_id_idx
  on public.logistics_admin_events (actor_id);

create index logistics_pickup_locations_ibge_code_idx
  on public.logistics_pickup_locations (ibge_code);

create index logistics_quote_events_actor_id_idx
  on public.logistics_quote_events (actor_id);

create index logistics_quote_events_quote_group_id_idx
  on public.logistics_quote_events (quote_group_id);

create index logistics_quote_groups_pickup_location_id_idx
  on public.logistics_quote_groups (pickup_location_id);

create index logistics_quote_groups_quoted_by_idx
  on public.logistics_quote_groups (quoted_by);

create index logistics_quote_groups_supplier_id_idx
  on public.logistics_quote_groups (supplier_id);

create index logistics_quote_items_product_id_idx
  on public.logistics_quote_items (product_id);

create index logistics_quotes_delivery_ibge_code_idx
  on public.logistics_quotes (delivery_ibge_code);

create index logistics_settings_updated_by_idx
  on public.logistics_settings (updated_by);
