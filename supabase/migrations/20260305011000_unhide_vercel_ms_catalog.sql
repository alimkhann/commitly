-- Make vercel/ms visible in public catalog again for QA review.
update public.generated_roadmaps
set
  is_catalog_visible = true,
  catalog_segment = 'default',
  updated_at = timezone('utc'::text, now())
where repo_full_name = 'vercel/ms';
