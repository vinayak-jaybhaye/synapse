package media

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/synapse/api/internal/errors"
	"github.com/synapse/api/internal/snowflake"
)

// Service defines the interface for media business logic
type Service interface {
	GenerateUploadURL(ctx context.Context, userID int64, entityID int64, req *UploadRequest) (*UploadResponse, error)
	GenerateDownloadURL(ctx context.Context, key string, expires time.Duration) (*DownloadResponse, error)
	GenerateObjectKey(category string, entityID int64, id string, extension string) string

	MarkUploadComplete(ctx context.Context, uploadID, userID int64) (*PendingUpload, error)
	CancelUpload(ctx context.Context, uploadID, userID int64) error
	StartCleanupJob(ctx context.Context, interval time.Duration)
}

type service struct {
	storage Storage
	repo    Repository
}

// NewService creates a new media service instance
func NewService(storage Storage, repo Repository) Service {
	return &service{
		storage: storage,
		repo:    repo,
	}
}

func (s *service) GenerateUploadURL(ctx context.Context, userID int64, entityID int64, req *UploadRequest) (*UploadResponse, error) {
	// 1. Validate Category
	policy, exists := Policies[req.Category]
	if !exists {
		return nil, ErrInvalidCategory
	}

	// 2. Validate Size
	if req.Size > policy.MaxSize {
		return nil, ErrFileTooLarge
	}

	// 3. Validate MIME Type
	isValidMime := false
	for _, mime := range policy.AllowedMimes {
		if req.ContentType == mime {
			isValidMime = true
			break
		}
	}
	if !isValidMime {
		return nil, ErrInvalidMimeType
	}

	// 4. Generate Object Key
	id := uuid.New().String()
	objectKey := s.GenerateObjectKey(req.Category, entityID, id, req.Extension)

	// 5. Generate Presigned URL
	expires := 15 * time.Minute
	uploadURL, err := s.storage.PresignPut(ctx, objectKey, req.ContentType, expires)
	if err != nil {
		return nil, err
	}

	// 6. Create Pending Upload Record
	uploadID := snowflake.GenerateID()
	expiresAt := time.Now().Add(expires)

	pending := &PendingUpload{
		ID:        uploadID,
		UserID:    userID,
		ObjectKey: objectKey,
		Category:  req.Category,
		FileName:  req.FileName,
		MimeType:  req.ContentType,
		FileSize:  req.Size,
		Status:    StatusRequested,
		CreatedAt: time.Now(),
		ExpiresAt: &expiresAt,
	}

	if err := s.repo.CreatePendingUpload(ctx, pending); err != nil {
		return nil, fmt.Errorf("failed to save pending upload: %w", err)
	}

	return &UploadResponse{
		UploadID:  uploadID,
		UploadURL: uploadURL,
		ObjectKey: objectKey,
		ExpiresIn: int(expires.Seconds()),
	}, nil
}

func (s *service) GenerateDownloadURL(ctx context.Context, key string, expires time.Duration) (*DownloadResponse, error) {
	if expires == 0 {
		expires = 15 * time.Minute
	}

	downloadURL, err := s.storage.PresignGet(ctx, key, expires)
	if err != nil {
		return nil, err
	}

	return &DownloadResponse{
		DownloadURL: downloadURL,
		ExpiresIn:   int(expires.Seconds()),
	}, nil
}

func (s *service) GenerateObjectKey(category string, entityID int64, id string, extension string) string {
	policy, exists := Policies[category]
	prefix := ""
	if exists {
		prefix = fmt.Sprintf(policy.Prefix, entityID)
	} else {
		prefix = fmt.Sprintf("%s/%d/", category, entityID)
	}
	return fmt.Sprintf("%s%s%s", prefix, id, extension)
}

func (s *service) MarkUploadComplete(ctx context.Context, uploadID, userID int64) (*PendingUpload, error) {
	upload, err := s.repo.GetPendingUpload(ctx, uploadID)
	if err != nil {
		return nil, err
	}
	if upload == nil {
		return nil, errors.NewNotFound("upload not found")
	}
	if upload.UserID != userID {
		return nil, errors.NewForbidden("you do not own this upload")
	}

	if upload.Status != StatusRequested && upload.Status != StatusUploading {
		return nil, errors.NewBadRequest("upload is not in a valid state to be completed")
	}

	err = s.repo.UpdateStatus(ctx, uploadID, StatusUploaded)
	if err != nil {
		return nil, err
	}
	return upload, nil
}

func (s *service) CancelUpload(ctx context.Context, uploadID, userID int64) error {
	upload, err := s.repo.GetPendingUpload(ctx, uploadID)
	if err != nil {
		return err
	}
	if upload == nil {
		return errors.NewNotFound("upload not found")
	}
	if upload.UserID != userID {
		return errors.NewForbidden("you do not own this upload")
	}

	// Always attempt to delete from storage, as it's safe if it doesn't exist
	_ = s.storage.Delete(ctx, upload.ObjectKey)

	return s.repo.DeletePendingUpload(ctx, uploadID)
}

// StartCleanupJob starts a background job that cleans up expired uploads
func (s *service) StartCleanupJob(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				s.cleanupExpiredUploads(ctx)
			}
		}
	}()
}

// cleanupExpiredUploads deletes expired uploads from S3 and the database
func (s *service) cleanupExpiredUploads(ctx context.Context) {
	uploads, err := s.repo.GetExpiredUploads(ctx)
	if err != nil {
		fmt.Printf("Cleanup job failed to get expired uploads: %v\n", err)
		return
	}

	for _, u := range uploads {
		// 1. Delete from S3
		err := s.storage.Delete(ctx, u.ObjectKey)
		if err != nil {
			fmt.Printf("Cleanup job failed to delete object %s: %v\n", u.ObjectKey, err)
			// Continue anyway to delete the record, or leave it for next time. We'll leave it if S3 fails.
			continue
		}

		// 2. Delete record
		_ = s.repo.DeletePendingUpload(ctx, u.ID)
	}
}
