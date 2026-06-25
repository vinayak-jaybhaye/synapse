package media

import "time"

type UploadStatus string

const (
	StatusRequested UploadStatus = "REQUESTED"
	StatusUploading UploadStatus = "UPLOADING"
	StatusUploaded  UploadStatus = "UPLOADED"
	StatusConsumed  UploadStatus = "CONSUMED"
	StatusCancelled UploadStatus = "CANCELLED"
	StatusFailed    UploadStatus = "FAILED"
	StatusExpired   UploadStatus = "EXPIRED"
)

type PendingUpload struct {
	ID        int64        `json:"id,string"`
	UserID    int64        `json:"user_id,string"`
	ObjectKey string       `json:"object_key"`
	Category  string       `json:"category"`
	FileName  string       `json:"file_name"`
	MimeType  string       `json:"mime_type"`
	FileSize  int64        `json:"file_size"`
	Status    UploadStatus `json:"status"`
	CreatedAt time.Time    `json:"created_at"`
	ExpiresAt *time.Time   `json:"expires_at,omitempty"`
}
