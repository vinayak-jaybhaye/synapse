package media

type UploadRequest struct {
	Category    string `json:"category" binding:"required"`
	Extension   string `json:"extension" binding:"required"`
	FileName    string `json:"file_name" binding:"required"`
	Size        int64  `json:"size" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
}

type UploadResponse struct {
	UploadID  int64  `json:"upload_id,string"`
	UploadURL string `json:"upload_url"`
	ObjectKey string `json:"object_key"`
	ExpiresIn int    `json:"expires_in"` // in seconds
}

type DownloadResponse struct {
	DownloadURL string `json:"download_url"`
	ExpiresIn   int    `json:"expires_in"` // in seconds
}

type DeleteRequest struct {
	ObjectKey string `json:"object_key" binding:"required"`
}
