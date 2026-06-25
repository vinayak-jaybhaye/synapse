package main

import (
	"encoding/json"
	"fmt"
)

type CreateMessageRequest struct {
	Content             string   `json:"content"`
	ReplyToMessageID    *int64   `json:"reply_to_message_id,string,omitempty"`
	AttachmentUploadIDs []string `json:"attachment_upload_ids,omitempty"`
}

func main() {
	j := `{"content": "", "attachment_upload_ids": ["2070134707864997888"]}`
	var req CreateMessageRequest
	err := json.Unmarshal([]byte(j), &req)
	fmt.Printf("Error: %v\nReq: %+v\n", err, req)
}
