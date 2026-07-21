package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/joho/godotenv/autoload"
	"github.com/synapse/api/internal/auth"
	"github.com/synapse/api/internal/blocks"
	"github.com/synapse/api/internal/channels"
	"github.com/synapse/api/internal/config"
	"github.com/synapse/api/internal/database"
	"github.com/synapse/api/internal/events"
	"github.com/synapse/api/internal/guilds"
	"github.com/synapse/api/internal/invites"
	"github.com/synapse/api/internal/media"
	"github.com/synapse/api/internal/messages"
	"github.com/synapse/api/internal/middleware"
	"github.com/synapse/api/internal/notifications"
	"github.com/synapse/api/internal/permissions"
	"github.com/synapse/api/internal/roles"
	"github.com/synapse/api/internal/router"
	"github.com/synapse/api/internal/snowflake"
	"github.com/synapse/api/internal/users"
	"github.com/synapse/api/internal/voice"
)

func main() {
	// 1. Initialize structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	slog.Info("Starting Synapse API Server bootstrapping...")

	// 2. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load environment configuration: %v", err)
	}

	// 3. Initialize Snowflake ID Generator Node
	if err := snowflake.InitNode(cfg.NodeID); err != nil {
		log.Fatalf("Failed to initialize Snowflake node: %v", err)
	}
	slog.Info("Snowflake ID generator initialized", "node_id", cfg.NodeID)

	// 4. Initialize Database Connections (Postgres & Redis)
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize databases: %v", err)
	}
	defer db.Close()

	// 5. Instantiate Repositories
	authRepo := auth.NewPGUserRepository(db.PG)
	userRepo := users.NewPGRepository(db.PG)
	roleRepo := roles.NewPGRepository(db.PG)
	guildRepo := guilds.NewPGRepository(db.PG)
	channelRepo := channels.NewPGRepository(db.PG)
	messageRepo := messages.NewPGRepository(db.PG)
	inviteRepo := invites.NewPGRepository(db.PG)
	sessionRepo := auth.NewPGSessionRepository(db.PG)

	// 6. Instantiate Services
	authService := auth.NewAuthService(authRepo)
	sessionService := auth.NewSessionService(sessionRepo, authRepo, cfg)

	// Start session cleanup on startup & background ticker
	go func() {
		ctx := context.Background()
		if count, err := sessionService.CleanupExpired(ctx); err == nil && count > 0 {
			slog.Info("Cleaned up expired sessions on startup", "count", count)
		} else if err != nil {
			slog.Error("Failed to clean up expired sessions on startup", "error", err)
		}

		ticker := time.NewTicker(12 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			count, err := sessionService.CleanupExpired(ctx)
			if err != nil {
				slog.Error("Failed to clean up expired sessions", "error", err)
			} else if count > 0 {
				slog.Info("Successfully cleaned up expired sessions", "count", count)
			}
		}
	}()

	// Media Service
	s3Storage, err := media.NewS3Storage(context.Background(), cfg)
	if err != nil {
		log.Fatalf("Failed to initialize media storage: %v", err)
	}
	mediaRepo := media.NewPGRepository(db.PG)
	mediaService := media.NewService(s3Storage, mediaRepo)
	mediaService.StartCleanupJob(context.Background(), time.Hour)
	mediaHandler := media.NewHandler(mediaService)

	// Permissions Service
	permRoleRepo := permissions.NewPGRoleRepository(db.PG)
	permChannelRepo := permissions.NewPGChannelPermissionRepository(db.PG)
	permissionService := permissions.NewService(permRoleRepo, permChannelRepo)

	// Blocks Service
	blocksRepo := blocks.NewPGRepository(db.PG)
	blocksService := blocks.NewService(blocksRepo)

	userService := users.NewService(userRepo, mediaService, db.Redis, permissionService, blocksService)
	roleService := roles.NewService(roleRepo)
	guildService := guilds.NewService(guildRepo, roleRepo, mediaService)
	channelService := channels.NewService(channelRepo, roleRepo, mediaService, permissionService)

	eventBus := events.NewEventBus()

	messageService := messages.NewService(messageRepo, channelRepo, permissionService, mediaService, blocksService, db.Redis, eventBus)
	inviteService := invites.NewService(inviteRepo, roleRepo)

	// Notifications
	notificationsRepo := notifications.NewPGRepository(db.PG)
	notificationsService := notifications.NewService(notificationsRepo, guildRepo, channelRepo, permissionService, db.Redis, eventBus)
	notificationsHandler := notifications.NewHandler(notificationsService)

	// Voice
	lkClient := voice.NewLiveKitClient(cfg.LiveKitAPIKey, cfg.LiveKitAPISecret, cfg.LiveKitURL)
	voiceRepo := voice.NewRepository(db.Redis)
	voiceService := voice.NewService(
		voiceRepo,
		lkClient,
		permissionService,
		time.Duration(cfg.VoiceStateTTL)*time.Second,
		cfg.LiveKitURL,
	)
	voiceHandler := voice.NewHandler(voiceService, channelRepo)

	// 7. Instantiate Handlers
	authHandler := auth.NewAuthHandler(authService, sessionService, cfg)
	userHandler := users.NewHandler(userService)
	roleHandler := roles.NewHandler(roleService)
	guildHandler := guilds.NewHandler(guildService)
	channelHandler := channels.NewHandler(channelService)
	messageHandler := messages.NewHandler(messageService)
	inviteHandler := invites.NewHandler(inviteService)
	blocksHandler := blocks.NewHandler(blocksService)

	// 8. Setup HTTP Engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	// Apply Middlewares
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.LoggingMiddleware())
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// 9. Register Routes
	router.SetupRoutes(
		r,
		sessionService,
		cfg,
		authHandler,
		userHandler,
		guildHandler,
		roleHandler,
		channelHandler,
		messageHandler,
		inviteHandler,
		mediaHandler,
		notificationsHandler,
		voiceHandler,
		blocksHandler,
	)

	slog.Info("Synapse Core HTTP API server running", "port", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
