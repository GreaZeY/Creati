-- Add client_id to analytics views for workspace isolation

DROP VIEW IF EXISTS vw_user_stats;
DROP VIEW IF EXISTS vw_video_stats;

CREATE OR REPLACE VIEW vw_video_stats AS
SELECT 
    v.id AS video_id,
    v.user_id,
    v.client_id,  -- Added for workspace-scoped analytics
    v.title,
    v.created_at,
    COALESCE(SUM(latest.views), 0) as total_views,
    COALESCE(SUM(latest.likes), 0) as total_likes,
    COALESCE(SUM(latest.comments), 0) as total_comments,
    COALESCE(SUM(latest.shares), 0) as total_shares,
    MAX(latest.fetched_at) as last_updated
FROM videos v
LEFT JOIN (
    -- Subquery to get only the most recent analytics record for each video+ACCOUNT
    SELECT DISTINCT ON (video_id, account_id) 
        video_id, account_id, views, likes, comments, shares, fetched_at
    FROM video_analytics
    ORDER BY video_id, account_id, fetched_at DESC
) latest ON v.id = latest.video_id
GROUP BY v.id;

CREATE OR REPLACE VIEW vw_user_stats AS
SELECT 
    user_id,
    client_id,  -- Added for workspace-scoped analytics
    COUNT(DISTINCT video_id) as total_videos,
    COALESCE(SUM(total_views), 0) as total_views,
    COALESCE(SUM(total_likes), 0) as total_likes,
    COALESCE(SUM(total_comments), 0) as total_comments,
    COALESCE(SUM(total_shares), 0) as total_shares
FROM vw_video_stats
GROUP BY user_id, client_id;
