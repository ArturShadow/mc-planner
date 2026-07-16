ALTER TABLE base_assignments ADD COLUMN assignment_group TEXT;

CREATE INDEX idx_base_assignments_group
    ON base_assignments(project_id, assignment_group);
