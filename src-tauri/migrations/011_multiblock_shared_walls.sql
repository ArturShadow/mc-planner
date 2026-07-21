ALTER TABLE multiblocks ADD COLUMN can_share_walls INTEGER NOT NULL DEFAULT 0
    CHECK (can_share_walls IN (0, 1));
