package errors

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIError represents a standardized structured error format returned to clients.
type APIError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *APIError) Error() string {
	return e.Message
}

func NewBadRequest(msg string) *APIError {
	return &APIError{Status: http.StatusBadRequest, Code: "BAD_REQUEST", Message: msg}
}

func NewUnauthorized(msg string) *APIError {
	return &APIError{Status: http.StatusUnauthorized, Code: "UNAUTHORIZED", Message: msg}
}

func NewForbidden(msg string) *APIError {
	return &APIError{Status: http.StatusForbidden, Code: "FORBIDDEN", Message: msg}
}

func NewNotFound(msg string) *APIError {
	return &APIError{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: msg}
}

func NewConflict(msg string) *APIError {
	return &APIError{Status: http.StatusConflict, Code: "CONFLICT", Message: msg}
}

func NewInternal(msg string) *APIError {
	return &APIError{Status: http.StatusInternalServerError, Code: "INTERNAL_SERVER_ERROR", Message: msg}
}

// HandleError parses any error, checks if it is a standardized APIError, and sends the correct HTTP response.
func HandleError(c *gin.Context, err error) {
	if apiErr, ok := err.(*APIError); ok {
		c.JSON(apiErr.Status, apiErr)
		return
	}
	c.JSON(http.StatusInternalServerError, APIError{
		Code:    "INTERNAL_SERVER_ERROR",
		Message: err.Error(),
	})
}
