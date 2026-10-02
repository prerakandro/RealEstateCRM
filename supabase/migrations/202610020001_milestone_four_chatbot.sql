-- Milestone 4: property assistant chatbot (rule-based, no external API).
-- The chatbot reuses the public search RPC. This migration extends it with the
-- filters the assistant can extract from natural language (state/region, exact
-- bedroom counts such as "2 BHK", and floor area). All new parameters default to
-- null, so existing callers keep their behaviour. The function stays SECURITY
-- INVOKER and keeps the explicit status = 'published' predicate, so RLS and the
-- published-only rule both still apply.

drop function if exists public.search_properties(text, public.listing_type, public.property_type, text, numeric, numeric, integer, integer, boolean, integer, integer);

create or replace function public.search_properties(
  p_query text default null,
  p_listing_type public.listing_type default null,
  p_property_type public.property_type default null,
  p_city text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_min_bathrooms integer default null,
  p_featured boolean default null,
  p_page integer default 1,
  p_page_size integer default 12,
  p_region text default null,
  p_max_bedrooms integer default null,
  p_min_area numeric default null,
  p_max_area numeric default null
) returns table(
  id uuid, slug text, title text, excerpt text, property_type public.property_type, listing_type public.listing_type,
  price numeric, currency text, city text, region text, bedrooms integer, bathrooms integer, parking_spaces integer,
  floor_area numeric, featured boolean, published_at timestamptz, primary_image_path text, primary_image_alt text, total_count bigint
) language sql stable security invoker set search_path = public as $$
  with filtered as (
    select p.*, count(*) over() total_count
    from properties p
    where p.status = 'published'
      and (p_query is null or p.title ilike '%'||p_query||'%' or p.city ilike '%'||p_query||'%' or p.region ilike '%'||p_query||'%')
      and (p_listing_type is null or p.listing_type = p_listing_type)
      and (p_property_type is null or p.property_type = p_property_type)
      and (p_city is null or p.city ilike '%'||p_city||'%')
      and (p_region is null or p.region ilike '%'||p_region||'%')
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (p_min_bedrooms is null or p.bedrooms >= p_min_bedrooms)
      and (p_max_bedrooms is null or p.bedrooms <= p_max_bedrooms)
      and (p_min_bathrooms is null or p.bathrooms >= p_min_bathrooms)
      and (p_min_area is null or p.floor_area >= p_min_area)
      and (p_max_area is null or p.floor_area <= p_max_area)
      and (p_featured is null or p.featured = p_featured)
  )
  select f.id, f.slug, f.title, f.excerpt, f.property_type, f.listing_type, f.price, f.currency, f.city, f.region,
         f.bedrooms, f.bathrooms, f.parking_spaces, f.floor_area, f.featured, f.published_at,
         i.storage_path, i.alt_text, f.total_count
  from filtered f
  left join property_images i on i.property_id = f.id and i.is_primary
  order by f.featured desc, f.published_at desc nulls last
  offset greatest(p_page - 1, 0) * least(greatest(p_page_size, 1), 50)
  limit least(greatest(p_page_size, 1), 50);
$$;

grant execute on function public.search_properties(text, public.listing_type, public.property_type, text, numeric, numeric, integer, integer, boolean, integer, integer, text, integer, numeric, numeric) to anon, authenticated;

create index if not exists properties_public_region on public.properties(status, region);
