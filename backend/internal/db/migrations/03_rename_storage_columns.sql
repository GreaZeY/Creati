-- Rename legacy S3 columns to generic Storage columns (Idempotent)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='videos' AND column_name='s3_url') THEN
        ALTER TABLE videos RENAME COLUMN s3_url TO storage_url;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_contents' AND column_name='s3_url') THEN
        ALTER TABLE platform_contents RENAME COLUMN s3_url TO storage_url;
    END IF;
END $$;
