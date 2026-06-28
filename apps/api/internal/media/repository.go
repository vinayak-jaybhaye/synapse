package media

import (
	"context"
	"database/sql"
	"time"
)

type Repository interface {
	CreatePendingUpload(ctx context.Context, upload *PendingUpload) error
	GetPendingUpload(ctx context.Context, id int64) (*PendingUpload, error)
	UpdateStatus(ctx context.Context, id int64, status UploadStatus) error
	DeletePendingUpload(ctx context.Context, id int64) error
	GetExpiredUploads(ctx context.Context) ([]PendingUpload, error)
	UpdateStatusByKey(ctx context.Context, key string, status UploadStatus, expiresAt time.Time) error
	DeletePendingUploadByKey(ctx context.Context, key string) error
}

type pgRepository struct {
	db *sql.DB
}

func NewPGRepository(db *sql.DB) Repository {
	return &pgRepository{db: db}
}

func (r *pgRepository) CreatePendingUpload(ctx context.Context, u *PendingUpload) error {
	query := `
		INSERT INTO pending_uploads (id, user_id, object_key, category, file_name, mime_type, file_size, status, created_at, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.ExecContext(ctx, query,
		u.ID, u.UserID, u.ObjectKey, u.Category, u.FileName, u.MimeType, u.FileSize, u.Status, u.CreatedAt, u.ExpiresAt,
	)
	return err
}

func (r *pgRepository) GetPendingUpload(ctx context.Context, id int64) (*PendingUpload, error) {
	query := `
		SELECT id, user_id, object_key, category, file_name, mime_type, file_size, status, created_at, expires_at
		FROM pending_uploads
		WHERE id = $1
	`
	row := r.db.QueryRowContext(ctx, query, id)
	var u PendingUpload
	err := row.Scan(
		&u.ID, &u.UserID, &u.ObjectKey, &u.Category, &u.FileName, &u.MimeType, &u.FileSize, &u.Status, &u.CreatedAt, &u.ExpiresAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *pgRepository) UpdateStatus(ctx context.Context, id int64, status UploadStatus) error {
	query := `UPDATE pending_uploads SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *pgRepository) DeletePendingUpload(ctx context.Context, id int64) error {
	query := `DELETE FROM pending_uploads WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *pgRepository) GetExpiredUploads(ctx context.Context) ([]PendingUpload, error) {
	query := `
		SELECT id, user_id, object_key, category, file_name, mime_type, file_size, status, created_at, expires_at
		FROM pending_uploads
		WHERE expires_at < NOW() AND status != $1
		LIMIT 100
	`
	rows, err := r.db.QueryContext(ctx, query, StatusConsumed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var uploads []PendingUpload
	for rows.Next() {
		var u PendingUpload
		if err := rows.Scan(
			&u.ID, &u.UserID, &u.ObjectKey, &u.Category, &u.FileName, &u.MimeType, &u.FileSize, &u.Status, &u.CreatedAt, &u.ExpiresAt,
		); err != nil {
			return nil, err
		}
		uploads = append(uploads, u)
	}
	return uploads, rows.Err()
}

func (r *pgRepository) UpdateStatusByKey(ctx context.Context, key string, status UploadStatus, expiresAt time.Time) error {
	query := `UPDATE pending_uploads SET status = $1, expires_at = $2 WHERE object_key = $3`
	_, err := r.db.ExecContext(ctx, query, status, expiresAt, key)
	return err
}

func (r *pgRepository) DeletePendingUploadByKey(ctx context.Context, key string) error {
	query := `DELETE FROM pending_uploads WHERE object_key = $1`
	_, err := r.db.ExecContext(ctx, query, key)
	return err
}
