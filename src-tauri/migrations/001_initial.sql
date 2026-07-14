CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_width_chunks INTEGER NOT NULL DEFAULT 3,
    base_height_chunks INTEGER NOT NULL DEFAULT 3,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    letter TEXT NOT NULL,
    color TEXT NOT NULL,
    width_chunks INTEGER NOT NULL CHECK (width_chunks > 0),
    height_chunks INTEGER NOT NULL CHECK (height_chunks > 0),
    layout_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE
);
