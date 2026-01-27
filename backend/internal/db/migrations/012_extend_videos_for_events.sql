-- Extend videos table for platform event tracking
-- Adds fields needed by event processor to correlate videos with platform events

ALTER TABLE videos
ALTER COLUMN s3_url DROP NOT NULL,  -- Not all videos come from uploads (some from webhook detection)
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),  -- Platform's video ID (YouTube video ID, etc.)
ADD COLUMN IF NOT EXISTS platform VARCHAR(50),      -- Source platform
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,  -- Platform-specific metadata
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Index for looking up videos by platform + external_id
CREATE INDEX IF NOT EXISTS idx_videos_external_id ON videos(platform, external_id);

-- Trigger for updated_at
CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON COLUMN videos.external_id IS 'Platform-specific video ID (e.g., YouTube video ID)';
COMMENT ON COLUMN videos.platform IS 'Platform where this video originated (youtube, instagram, etc.)';
COMMENT ON COLUMN videos.metadata IS 'Platform-specific metadata from webhook payload';
