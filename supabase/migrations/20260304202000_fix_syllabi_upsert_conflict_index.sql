drop index if exists public.uq_roadmap_syllabi_snapshot_pipeline;
create unique index if not exists uq_roadmap_syllabi_snapshot_pipeline
  on public.roadmap_syllabi (snapshot_key, pipeline_version);
