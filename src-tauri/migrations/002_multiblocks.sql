CREATE TABLE multiblocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    symbol TEXT NOT NULL CHECK (length(symbol) = 1),
    width_blocks INTEGER NOT NULL CHECK (width_blocks > 0),
    depth_blocks INTEGER NOT NULL CHECK (depth_blocks > 0),
    height_blocks INTEGER NOT NULL CHECK (height_blocks > 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
