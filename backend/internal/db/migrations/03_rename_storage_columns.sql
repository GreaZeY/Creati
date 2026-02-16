-- Rename legacy S3 columns to generic Storage columns
ALTER TABLE videos RENAME COLUMN s3_url TO storage_url;
ALTER TABLE platform_contents RENAME COLUMN s3_key TO storage_key;
