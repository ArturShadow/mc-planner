CREATE INDEX idx_processes_project_id
    ON processes(project_id);

CREATE INDEX idx_base_assignments_project_id
    ON base_assignments(project_id);

CREATE INDEX idx_base_assignments_process_id
    ON base_assignments(process_id);

CREATE INDEX idx_multiblocks_name
    ON multiblocks(name);

CREATE INDEX idx_item_catalog_name
    ON item_catalog(name);

CREATE INDEX idx_item_catalog_category
    ON item_catalog(category);

CREATE INDEX idx_multiblock_requirements_multiblock_id
    ON multiblock_requirements(multiblock_id);

CREATE INDEX idx_multiblock_requirements_item_id
    ON multiblock_requirements(item_id);
