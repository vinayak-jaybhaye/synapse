package blocks

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/errors"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) BlockUser(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	blockerID := userIDRaw.(int64)

	blockedIDStr := c.Param("id")
	blockedID, err := strconv.ParseInt(blockedIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid user id"))
		return
	}

	err = h.svc.BlockUser(c.Request.Context(), blockerID, blockedID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "blocked"})
}

func (h *Handler) UnblockUser(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	blockerID := userIDRaw.(int64)

	blockedIDStr := c.Param("id")
	blockedID, err := strconv.ParseInt(blockedIDStr, 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid user id"))
		return
	}

	err = h.svc.UnblockUser(c.Request.Context(), blockerID, blockedID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unblocked"})
}

func (h *Handler) GetBlockedUsers(c *gin.Context) {
	userIDRaw, _ := c.Get("user_id")
	blockerID := userIDRaw.(int64)

	blockedIDs, err := h.svc.GetBlockedUsers(c.Request.Context(), blockerID)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	// Convert int64 slice to string slice for JSON compatibility with snowflake IDs
	var stringIDs []string
	for _, id := range blockedIDs {
		stringIDs = append(stringIDs, strconv.FormatInt(id, 10))
	}
	if stringIDs == nil {
		stringIDs = []string{}
	}

	c.JSON(http.StatusOK, stringIDs)
}
