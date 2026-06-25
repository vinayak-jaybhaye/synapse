package media

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	appConfig "github.com/synapse/api/internal/config"
)

type s3Storage struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
}

// NewS3Storage initializes a new S3 storage implementation using AWS SDK v2
func NewS3Storage(ctx context.Context, cfg *appConfig.Config) (Storage, error) {
	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(cfg.AWSRegion),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AWSAccessKeyID,
			cfg.AWSSecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.S3UsePathStyle
		if cfg.S3Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.S3Endpoint)
		}
	})

	presignClient := s3.NewPresignClient(client)

	return &s3Storage{
		client:        client,
		presignClient: presignClient,
		bucket:        cfg.S3Bucket,
	}, nil
}

// PresignPut generates a pre-signed URL for uploading an object to S3
func (s *s3Storage) PresignPut(ctx context.Context, key string, contentType string, expires time.Duration) (string, error) {
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		log.Printf("Failed to generate presigned PUT url for key %s: %v", key, err)
		return "", ErrStorageFailure
	}

	return req.URL, nil
}

// PresignGet generates a pre-signed URL for downloading an object from S3
func (s *s3Storage) PresignGet(ctx context.Context, key string, expires time.Duration) (string, error) {
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expires))
	if err != nil {
		log.Printf("Failed to generate presigned GET url for key %s: %v", key, err)
		return "", ErrStorageFailure
	}

	return req.URL, nil
}

// Delete removes an object from S3
func (s *s3Storage) Delete(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		log.Printf("Failed to delete object key %s: %v", key, err)
		return ErrStorageFailure
	}

	return nil
}
