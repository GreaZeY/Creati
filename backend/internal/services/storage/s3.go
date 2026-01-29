package storage

import (
	"context"
	"fmt"
	"io"
	"os"

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
