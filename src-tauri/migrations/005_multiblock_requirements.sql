CREATE TABLE multiblock_requirements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    multiblock_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    role TEXT,
    notes TEXT,

    FOREIGN KEY (multiblock_id)
        REFERENCES multiblocks(id)
        ON DELETE CASCADE,

    FOREIGN KEY (item_id)
        REFERENCES item_catalog(id)
        ON DELETE RESTRICT,

    UNIQUE (multiblock_id, item_id, role)
);
