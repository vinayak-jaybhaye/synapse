package audit

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

func (h *Handler) GetGuildAuditLogs(c *gin.Context) {
	userID := c.GetInt64("user_id")

	guildID, err := strconv.ParseInt(c.Param("guildID"), 10, 64)
	if err != nil {
		errors.HandleError(c, errors.NewBadRequest("invalid guild ID"))
		return
	}

	filter := AuditLogFilter{
		Limit: 50,
	}

	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			filter.Limit = l
		}
	}

	if beforeStr := c.Query("before"); beforeStr != "" {
		if b, err := strconv.ParseInt(beforeStr, 10, 64); err == nil {
			filter.BeforeID = &b
		}
	}

	if actionStr := c.Query("action"); actionStr != "" {
		if act, err := strconv.Atoi(actionStr); err == nil {
			actionEnum := Action(act)
			filter.Action = &actionEnum
		}
	}

	if actorStr := c.Query("actor_id"); actorStr != "" {
		if actorID, err := strconv.ParseInt(actorStr, 10, 64); err == nil {
			filter.ActorID = &actorID
		}
	}

	if targetTypeStr := c.Query("target_type"); targetTypeStr != "" {
		if tt, err := strconv.Atoi(targetTypeStr); err == nil {
			targetTypeEnum := TargetType(tt)
			filter.TargetType = &targetTypeEnum
		}
	}

	if targetIDStr := c.Query("target_id"); targetIDStr != "" {
		if tid, err := strconv.ParseInt(targetIDStr, 10, 64); err == nil {
			filter.TargetID = &tid
		}
	}

	logs, err := h.svc.ListGuildLogs(c.Request.Context(), guildID, userID, filter)
	if err != nil {
		errors.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, logs)
}
