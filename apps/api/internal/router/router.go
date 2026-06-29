package router

import (
	"github.com/gin-gonic/gin"
	"github.com/synapse/api/internal/auth"
	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/guilds"
	"github.com/synapse/api/internal/invites"
	"github.com/synapse/api/internal/media"
	"github.com/synapse/api/internal/messages"
	"github.com/synapse/api/internal/middleware"
	"github.com/synapse/api/internal/notifications"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/users"
	"github.com/synapse/api/internal/voice"
)

func SetupRoutes(
	r *gin.Engine,
	tokenService auth.TokenService,
	authHandler *auth.AuthHandler,
	userHandler *users.Handler,
	guildHandler *guilds.Handler,
	roleHandler *roles.Handler,
	channelHandler *channels.Handler,
	messageHandler *messages.Handler,
	inviteHandler *invites.Handler,
	mediaHandler *media.Handler,
	notificationsHandler *notifications.Handler,
	voiceHandler *voice.Handler,
) {
	// Root Group
	v1 := r.Group("/api/v1")

	// Authentication (Unprotected)
	authGroup := v1.Group("/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	// Protected Routes Group
	protected := v1.Group("/")
	protected.Use(middleware.AuthMiddleware(tokenService))
	{
		// Users
		protected.GET("/users/@me", userHandler.GetMe)
		protected.PATCH("/users/@me", userHandler.UpdateProfile)
		protected.GET("/users/@me/guilds", userHandler.GetMeGuilds)
		protected.GET("/users/@me/dms", userHandler.GetDMs)
		protected.GET("/users/:userId/profile", userHandler.GetProfile)
		protected.POST("/users/@me/avatars/upload-url", userHandler.GenerateAvatarUploadURL)
		protected.POST("/users/@me/banners/upload-url", userHandler.GenerateBannerUploadURL)
		protected.POST("/dms", userHandler.CreateDM)

		// Notifications
		protected.GET("/users/@me/notifications", notificationsHandler.GetUserSettings)
		protected.PUT("/users/@me/notifications/global", notificationsHandler.PutGlobalSettings)
		protected.PUT("/users/@me/notifications/guilds/:guildID", notificationsHandler.PutGuildSettings)
		protected.PUT("/users/@me/notifications/channels/:channelID", notificationsHandler.PutChannelSettings)

		// Guilds
		protected.POST("/guilds", guildHandler.CreateGuild)
		protected.GET("/guilds/:guildID", guildHandler.GetGuild)
		protected.PATCH("/guilds/:guildID", guildHandler.UpdateGuild)
		protected.GET("/guilds/:guildID/members", guildHandler.GetGuildMembers)
		protected.PATCH("/guilds/:guildID/members/:userID", guildHandler.PatchGuildMember)
		protected.DELETE("/guilds/:guildID/members/:userID", guildHandler.KickMember)
		protected.POST("/guilds/:guildID/bans/:userID", guildHandler.BanMember)
		protected.GET("/guilds/:guildID/bans", guildHandler.GetBans)
		protected.DELETE("/guilds/:guildID/bans/:userID", guildHandler.UnbanMember)
		protected.POST("/guilds/:guildID/icons/upload-url", guildHandler.GenerateIconUploadURL)
		protected.POST("/guilds/:guildID/banners/upload-url", guildHandler.GenerateBannerUploadURL)

		// Roles
		protected.GET("/guilds/:guildID/roles", roleHandler.GetRoles)
		protected.POST("/guilds/:guildID/roles", roleHandler.CreateRole)
		protected.PATCH("/guilds/:guildID/roles/:roleID", roleHandler.UpdateRole)
		protected.DELETE("/guilds/:guildID/roles/:roleID", roleHandler.DeleteRole)
		protected.PUT("/guilds/:guildID/members/:userID/roles/:roleID", roleHandler.PutMemberRole)
		protected.DELETE("/guilds/:guildID/members/:userID/roles/:roleID", roleHandler.DeleteMemberRole)

		// Channels
		protected.GET("/guilds/:guildID/channels", channelHandler.GetChannels)
		protected.POST("/guilds/:guildID/channels", channelHandler.CreateChannel)
		protected.PATCH("/channels/:channelID", channelHandler.UpdateChannel)
		protected.DELETE("/channels/:channelID", channelHandler.DeleteChannel)

		// Channel Permissions
		protected.GET("/channels/:channelID/permissions", channelHandler.GetRoleOverrides)
		protected.PUT("/channels/:channelID/permissions/:roleID", channelHandler.PutRoleOverride)
		protected.DELETE("/channels/:channelID/permissions/:roleID", channelHandler.DeleteRoleOverride)

		// Messages
		protected.GET("/channels/:channelID/messages", messageHandler.GetMessages)
		protected.POST("/channels/:channelID/messages", messageHandler.SendMessage)
		protected.PATCH("/channels/:channelID/messages/:messageID", messageHandler.EditMessage)
		protected.DELETE("/channels/:channelID/messages/:messageID", messageHandler.DeleteMessage)
		protected.POST("/channels/:channelID/read", messageHandler.SyncReadState)
		protected.POST("/channels/:channelID/attachments/upload-url", messageHandler.GenerateAttachmentUploadURL)
		protected.GET("/channels/:channelID/attachments/:attachmentID", messageHandler.DownloadAttachment)

		// Reactions
		protected.PUT("/channels/:channelID/messages/:messageID/reactions/:emoji", messageHandler.PutReaction)
		protected.DELETE("/channels/:channelID/messages/:messageID/reactions/:emoji", messageHandler.DeleteReaction)

		// Invites
		protected.POST("/guilds/:guildID/invites", inviteHandler.CreateInvite)
		protected.GET("/invites/:code", inviteHandler.GetInvite)
		protected.POST("/invites/:code/join", inviteHandler.JoinGuild)

		// Media
		protected.POST("/media/uploads/:uploadID/complete", mediaHandler.MarkUploadComplete)
		protected.DELETE("/media/uploads/:uploadID", mediaHandler.CancelUpload)

		// Voice
		protected.POST("/channels/:channelID/voice/join", voiceHandler.JoinVoice)
		protected.DELETE("/channels/:channelID/voice/leave", voiceHandler.LeaveVoice)
		protected.GET("/channels/:channelID/voice", voiceHandler.GetVoiceStates)

		// Voice — Moderator Actions
		protected.POST("/channels/:channelID/voice/members/:targetUserID/mute", voiceHandler.ModServerMute)
		protected.DELETE("/channels/:channelID/voice/members/:targetUserID/mute", voiceHandler.ModServerMute)
		protected.POST("/channels/:channelID/voice/members/:targetUserID/deafen", voiceHandler.ModServerDeafen)
		protected.DELETE("/channels/:channelID/voice/members/:targetUserID/deafen", voiceHandler.ModServerDeafen)
		protected.POST("/channels/:channelID/voice/members/:targetUserID/disconnect", voiceHandler.ModDisconnect)
	}

	// LiveKit Webhook — unauthenticated (signature verified internally)
	v1.POST("/voice/webhook", voiceHandler.Webhook)
}
