ALTER TABLE catalog_sources ADD COLUMN content_hash TEXT;
ALTER TABLE catalog_sources ADD COLUMN mod_version TEXT;
ALTER TABLE catalog_sources ADD COLUMN source_path TEXT;

CREATE INDEX idx_catalog_sources_hash
    ON catalog_sources(project_id, source_type, content_hash);
