-- Analytics Schema
-- Table to store historical snapshots of video performance
CREATE TABLE IF NOT EXISTS video_analytics (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX idx_analytics_video ON video_analytics(video_id);
CREATE INDEX idx_analytics_video_platform ON video_analytics(video_id, platform);
CREATE INDEX idx_analytics_fetched ON video_analytics(fetched_at DESC);

-- View: vw_video_stats
-- Aggregates the LATEST snapshot for each platform per video
CREATE OR REPLACE VIEW vw_video_stats AS
SELECT 
    v.id AS video_id,
    v.user_id,
    v.title,
    v.created_at,
    COALESCE(SUM(latest.views), 0) as total_views,
    COALESCE(SUM(latest.likes), 0) as total_likes,
    COALESCE(SUM(latest.comments), 0) as total_comments,
    COALESCE(SUM(latest.shares), 0) as total_shares,
    MAX(latest.fetched_at) as last_updated
FROM videos v
LEFT JOIN (
    -- Subquery to get only the most recent analytics record for each video+platform
    SELECT DISTINCT ON (video_id, platform) 
        video_id, platform, views, likes, comments, shares, fetched_at
    FROM video_analytics
    ORDER BY video_id, platform, fetched_at DESC
) latest ON v.id = latest.video_id
GROUP BY v.id;

-- View: vw_user_stats
-- Aggregates total metrics for a user across all their videos
CREATE OR REPLACE VIEW vw_user_stats AS
SELECT 
    user_id,
    COUNT(video_id) as total_videos,
    COALESCE(SUM(total_views), 0) as total_views,
    COALESCE(SUM(total_likes), 0) as total_likes,
    COALESCE(SUM(total_comments), 0) as total_comments,
    COALESCE(SUM(total_shares), 0) as total_shares
FROM vw_video_stats
GROUP BY user_id;
