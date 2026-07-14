CREATE TABLE base_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    process_id INTEGER,
    chunk_x INTEGER NOT NULL,
    chunk_y INTEGER NOT NULL,

    FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,

    FOREIGN KEY (process_id)
        REFERENCES processes(id)
        ON DELETE SET NULL,

    UNIQUE (project_id, chunk_x, chunk_y)
);
