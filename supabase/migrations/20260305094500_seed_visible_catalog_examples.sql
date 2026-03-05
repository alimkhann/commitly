-- Promote a curated set of existing generated roadmaps to visible catalog examples.
update public.generated_roadmaps
set
  is_catalog_visible = true,
  catalog_segment = coalesce(nullif(catalog_segment, ''), 'default'),
  updated_at = now()
where repo_full_name in (
  'vercel/ms',
  'sindresorhus/ky',
  'umami-software/umami',
  'dubinc/dub',
  'calcom/cal.com',
  'upstash/redis-js'
);
