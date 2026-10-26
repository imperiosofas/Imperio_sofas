-- Keep the quote's address only in its operational snapshot columns. The
-- fingerprint remains useful for idempotency/invalidation without duplicating
-- address PII in JSON.
do $migration$
declare
  v_definition text;
  v_old text := $old$
  v_fingerprint := jsonb_build_object(
    'supplier_modes', p_supplier_modes,
    'address', case when v_has_delivery then jsonb_build_object(
      'postal_code', v_cep,
      'street', trim(v_address ->> 'street'),
      'number', trim(v_address ->> 'number'),
      'complement', nullif(trim(v_address ->> 'complement'), ''),
      'neighborhood', trim(v_address ->> 'neighborhood'),
      'ibge_code', v_ibge_code,
      'city_name', v_city_name,
      'state_code', v_state_code,
      'floor_number', v_floor
    ) else '{}'::jsonb end
  );
$old$;
  v_new text := $new$
  v_fingerprint := jsonb_build_object(
    'version', 1,
    'sha256', encode(extensions.digest(convert_to(jsonb_build_object(
      'supplier_modes', p_supplier_modes,
      'address', case when v_has_delivery then jsonb_build_object(
        'postal_code', v_cep,
        'street', trim(v_address ->> 'street'),
        'number', trim(v_address ->> 'number'),
        'complement', nullif(trim(v_address ->> 'complement'), ''),
        'neighborhood', trim(v_address ->> 'neighborhood'),
        'ibge_code', v_ibge_code,
        'city_name', v_city_name,
        'state_code', v_state_code,
        'floor_number', v_floor
      ) else '{}'::jsonb end
    )::text, 'UTF8'), 'sha256'), 'hex')
  );
$new$;
begin
  select pg_get_functiondef(
    'public.logistics_create_quote_server(uuid,uuid,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  if length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
    raise exception 'Expected exactly one legacy quote fingerprint expression';
  end if;

  execute replace(v_definition, v_old, v_new);

  update public.logistics_quotes q
  set request_fingerprint = jsonb_build_object(
    'version', 1,
    'sha256', encode(
      extensions.digest(convert_to(q.request_fingerprint::text, 'UTF8'), 'sha256'),
      'hex'
    )
  )
  where q.request_fingerprint ->> 'version' is distinct from '1'
     or coalesce(q.request_fingerprint ->> 'sha256', '') !~ '^[a-f0-9]{64}$';
end;
$migration$;

alter table public.logistics_quotes
  add constraint logistics_quotes_request_fingerprint_digest_check
  check (
    request_fingerprint ->> 'version' = '1'
    and coalesce(request_fingerprint ->> 'sha256', '') ~ '^[a-f0-9]{64}$'
  );

comment on column public.logistics_quotes.request_fingerprint is
  'Versioned SHA-256 digest of normalized quote inputs. Address PII is stored only in the quote snapshot columns and must follow the approved retention policy.';

-- Bulk supplier classification remains an explicit authenticated admin action.
-- Calling the existing audited SECURITY DEFINER function preserves its admin
-- membership check, product lock, and quote invalidation behavior per product.
create function public.admin_assign_products_supplier(
  p_product_ids uuid[],
  p_supplier_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_updated_count integer := 0;
begin
  if p_supplier_id is null then
    raise exception 'supplier id required' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_product_ids), 0) not between 1 and 100
     or array_position(p_product_ids, null) is not null
     or (select count(distinct selected.product_id) from unnest(p_product_ids) selected(product_id))
        <> cardinality(p_product_ids) then
    raise exception 'between one and one hundred unique product ids are required'
      using errcode = '22023';
  end if;

  for v_product_id in
    select selected.product_id
    from unnest(p_product_ids) selected(product_id)
    order by selected.product_id
  loop
    perform public.admin_assign_product_supplier(v_product_id, p_supplier_id);
    v_updated_count := v_updated_count + 1;
  end loop;

  return v_updated_count;
end;
$$;

revoke all on function public.admin_assign_products_supplier(uuid[], uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_assign_products_supplier(uuid[], uuid)
  to authenticated;
comment on function public.admin_assign_products_supplier(uuid[], uuid) is
  'Atomically assigns one explicitly selected supplier to 1–100 explicitly selected products. Each assignment uses the existing audited admin authorization and invalidation path.';
