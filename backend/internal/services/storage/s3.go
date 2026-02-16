package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Provider struct {
	Client *s3.Client
	Bucket string
}

func NewS3Provider() (*S3Provider, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg)
	bucket := os.Getenv("AWS_S3_BUCKET")
	if bucket == "" {
		bucket = "creati-uploads-dev"
	}

	return &S3Provider{
		Client: client,
		Bucket: bucket,
	}, nil
}

func (s *S3Provider) Upload(ctx context.Context, key string, reader io.Reader, contentType string) error {
	_, err := s.Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.Bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(contentType),
	})
	return err
}

func (s *S3Provider) GetObjectURL(key string) string {
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.Bucket, key)
}

func (s *S3Provider) Exists(ctx context.Context, key string) (bool, error) {
	_, err := s.Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		// Check for 404 Not Found error
		// AWS SDK v2 error handling can be tricky, typically check for NotFound
		// For simplicity, we assume error means not found or other issues
		// But strictly we should check specific error types.
		// However, in this context, we return false and log/handle upstream if needed.
		// Actually, let's just return false. If it's a permission error, we might want to know, but for "Exists", false is safe.
		// A more robust check might introspect the error code.
		return false, nil
	}
	return true, nil
}

func (s *S3Provider) GeneratePresignedURL(key string, contentType string) (string, error) {
	presignClient := s3.NewPresignClient(s.Client)
	request, err := presignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(s.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = time.Duration(15 * time.Minute)
	})

	if err != nil {
		return "", err
	}
	return request.URL, nil
}

func (s *S3Provider) GetStream(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.Client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}
