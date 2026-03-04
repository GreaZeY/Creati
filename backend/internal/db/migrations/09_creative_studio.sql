-- 09_creative_studio.sql
-- Assets for the advanced video editor

CREATE TABLE IF NOT EXISTS media_assets (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id),
    type VARCHAR(50) NOT NULL, -- 'audio', 'sticker', 'overlay', 'preset'
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- duration, waveforms, dimensions, etc.
    tags TEXT[],
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed some default public assets (Royalty-free placeholder music)
INSERT INTO media_assets (type, name, url, metadata, is_public, tags)
VALUES 
('audio', 'Cyberpunk Pulse', 'https://assets.creati.in/music/cyber-pulse.mp3', '{"duration": 120, "genre": "Electronic"}', TRUE, ARRAY['cyber', 'energetic']),
('audio', 'Lo-Fi Dreams', 'https://assets.creati.in/music/lofi-dreams.mp3', '{"duration": 180, "genre": "Lofi"}', TRUE, ARRAY['chill', 'background']),
('sticker', 'Vibrant Star', 'https://assets.creati.in/stickers/star.png', '{}', TRUE, ARRAY['shape', 'bright']);

-- Indexes for search
CREATE INDEX idx_media_assets_type ON media_assets(type);
CREATE INDEX idx_media_assets_org_tags ON media_assets USING GIN (tags);
