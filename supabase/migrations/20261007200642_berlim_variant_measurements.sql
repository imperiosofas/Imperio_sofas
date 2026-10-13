-- Backfill only dimensions explicitly present in the legacy variant labels.
-- Keep this narrowly scoped and fail closed if the managed import drifted.
do $migration$
declare
  v_product_id constant uuid := '26b943bd-45f8-49c2-989c-0f1ddcbea356';
  v_source_id constant uuid := 'ca706444-d0fc-4960-985c-07b7a394705b';
  v_import private.legacy_catalog_imports%rowtype;
  v_snapshot jsonb;
  v_variant_count integer;
  v_expected_count integer;
begin
  select * into v_import
  from private.legacy_catalog_imports
  where source_product_id = v_source_id
  for update;

  if not found or v_import.target_product_id is distinct from v_product_id then
    raise exception 'berlin_import_ledger_missing_or_mismatched';
  end if;

  v_snapshot := private.legacy_product_snapshot(v_product_id);
  if v_snapshot is distinct from v_import.applied_snapshot then
    raise exception 'berlin_import_target_drifted_review_required';
  end if;

  select count(*) into v_variant_count
  from public.product_variants v
  where v.product_id = v_product_id;

  select count(*) into v_expected_count
  from public.product_variants v
  join public.inventory i on i.variant_id = v.id
  where v.product_id = v_product_id
    and v.sku in (
      'IMP-SOF-SOFABERLIM-210',
      'IMP-SOF-SOFABERLIM-230',
      'IMP-SOF-SOFABERLIM-250',
      'IMP-SOF-SOFABERLIM-290'
    )
    and v.price_cents = case v.attributes ->> 'source_variant_label'
      when '2.10 m' then 382800
      when '2.30 m' then 394800
      when '2.50 m' then 402800
      when '2.90 m' then 430000
      else null
    end
    and v.attributes ->> 'source_variant_label' = case v.sku
      when 'IMP-SOF-SOFABERLIM-210' then '2.10 m'
      when 'IMP-SOF-SOFABERLIM-230' then '2.30 m'
      when 'IMP-SOF-SOFABERLIM-250' then '2.50 m'
      when 'IMP-SOF-SOFABERLIM-290' then '2.90 m'
      else null
    end
    and v.depth_mm is null
    and v.height_mm is null
    and not v.is_active
    and i.on_hand = 10
    and i.reserved = 0
    and i.low_stock_threshold = 5;

  if v_variant_count <> 4 or v_expected_count <> 4 then
    raise exception 'berlin_variant_state_unexpected_review_required';
  end if;

  if exists (
    select 1
    from public.product_variants v
    where v.product_id = v_product_id
      and (
        v.width_mm is distinct from case v.attributes ->> 'source_variant_label'
          when '2.10 m' then 2100
          when '2.30 m' then 2300
          when '2.50 m' then 2500
          when '2.90 m' then 2900
          else null
        end
        or v.attributes ->> 'source_variant_width_label' is distinct from v.attributes ->> 'source_variant_label'
        or (v.attributes ->> 'source_variant_width_mm')::integer is distinct from case v.attributes ->> 'source_variant_label'
          when '2.10 m' then 2100
          when '2.30 m' then 2300
          when '2.50 m' then 2500
          when '2.90 m' then 2900
          else null
        end
      )
  ) then
    if exists (
      select 1
      from public.product_variants v
      where v.product_id = v_product_id
        and (
          v.width_mm is not null
          or v.attributes ? 'source_variant_width_label'
          or v.attributes ? 'source_variant_width_mm'
        )
    ) then
      raise exception 'berlin_dimensions_partially_migrated_review_required';
    end if;

    update public.product_variants v
    set width_mm = case v.attributes ->> 'source_variant_label'
          when '2.10 m' then 2100
          when '2.30 m' then 2300
          when '2.50 m' then 2500
          when '2.90 m' then 2900
        end,
        attributes = jsonb_set(
          jsonb_set(coalesce(v.attributes, '{}'::jsonb), '{source_variant_width_label}', to_jsonb(v.attributes ->> 'source_variant_label'), true),
          '{source_variant_width_mm}',
          to_jsonb(case v.attributes ->> 'source_variant_label'
            when '2.10 m' then 2100
            when '2.30 m' then 2300
            when '2.50 m' then 2500
            when '2.90 m' then 2900
          end),
          true
        )
    where v.product_id = v_product_id;
  end if;

  update private.legacy_catalog_imports
  set applied_snapshot = private.legacy_product_snapshot(v_product_id),
      updated_at = now()
  where source_product_id = v_source_id;
end;
$migration$;
