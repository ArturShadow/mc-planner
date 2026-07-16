ALTER TABLE projects ADD COLUMN survival_type TEXT NOT NULL DEFAULT 'vanilla'
    CHECK (survival_type IN ('vanilla', 'technical_vanilla', 'modpack'));
ALTER TABLE projects ADD COLUMN minecraft_version TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN include_vanilla INTEGER NOT NULL DEFAULT 1 CHECK (include_vanilla IN (0, 1));

ALTER TABLE item_catalog ADD COLUMN minecraft_version TEXT;
ALTER TABLE item_catalog ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('vanilla', 'mod', 'manual'));
ALTER TABLE item_catalog ADD COLUMN source_id TEXT;

CREATE TABLE catalog_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    source_type TEXT NOT NULL CHECK (source_type IN ('vanilla', 'mod', 'manual')),
    source_identifier TEXT NOT NULL,
    display_name TEXT NOT NULL,
    minecraft_version TEXT,
    adds_catalog_content INTEGER NOT NULL DEFAULT 1 CHECK (adds_catalog_content IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE (project_id, source_type, source_identifier)
);

CREATE TABLE process_placements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER NOT NULL,
    placement_type TEXT NOT NULL CHECK (placement_type IN ('catalog_item', 'multiblock')),
    item_id INTEGER,
    multiblock_id INTEGER,
    origin_x INTEGER NOT NULL CHECK (origin_x >= 0),
    origin_z INTEGER NOT NULL CHECK (origin_z >= 0),
    width_blocks INTEGER NOT NULL CHECK (width_blocks > 0),
    depth_blocks INTEGER NOT NULL CHECK (depth_blocks > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (process_id) REFERENCES processes(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES item_catalog(id) ON DELETE RESTRICT,
    FOREIGN KEY (multiblock_id) REFERENCES multiblocks(id) ON DELETE RESTRICT,
    CHECK (
        (placement_type = 'catalog_item' AND item_id IS NOT NULL AND multiblock_id IS NULL) OR
        (placement_type = 'multiblock' AND multiblock_id IS NOT NULL AND item_id IS NULL)
    )
);

CREATE INDEX idx_process_placements_process_id ON process_placements(process_id);
CREATE INDEX idx_item_catalog_compatibility
    ON item_catalog(category, minecraft_version, source_type, name);
