package services

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type StorageService struct {
	Client        *s3.Client
	PresignClient *s3.PresignClient
	Bucket        string
}

func NewStorageService() (*StorageService, error) {
	cfg, err := config.LoadDefaultConfig(context.TODO())
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg)
	presignClient := s3.NewPresignClient(client)

	// In a real app, load from env
	bucket := "creati-uploads-dev"

	return &StorageService{
		Client:        client,
		PresignClient: presignClient,
		Bucket:        bucket,
	}, nil
}

func (s *StorageService) GeneratePresignedURL(key string, contentType string) (string, error) {
	request, err := s.PresignClient.PresignPutObject(context.TODO(), &s3.PutObjectInput{
		Bucket:      aws.String(s.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = 15 * time.Minute
	})

	if err != nil {
		return "", err
	}

	return request.URL, nil
}
