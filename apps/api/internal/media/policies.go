package media

type CategoryPolicy struct {
	Prefix       string
	MaxSize      int64 // in bytes
	AllowedMimes []string
}

const (
	CategoryAvatar      = "avatar"
	CategoryBanner      = "banner"
	CategoryGuildIcon   = "guild-icon"
	CategoryAttachment  = "attachment"

	MB = 1024 * 1024
)

var defaultImageMimes = []string{
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
}

var allMediaMimes = []string{
	// Images
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
	// Video
	"video/mp4",
	"video/webm",
	"video/quicktime",
	// Audio
	"audio/mpeg",
	"audio/ogg",
	"audio/wav",
	// Documents
	"application/pdf",
	"text/plain",
}

var Policies = map[string]CategoryPolicy{
	CategoryAvatar: {
		Prefix:       "avatars/%d/",
		MaxSize:      10 * MB,
		AllowedMimes: defaultImageMimes,
	},
	CategoryBanner: {
		Prefix:       "banners/%d/",
		MaxSize:      20 * MB,
		AllowedMimes: defaultImageMimes,
	},
	CategoryGuildIcon: {
		Prefix:       "guild-icons/%d/",
		MaxSize:      10 * MB,
		AllowedMimes: defaultImageMimes,
	},
	CategoryAttachment: {
		Prefix:       "attachments/%d/",
		MaxSize:      25 * MB,
		AllowedMimes: allMediaMimes,
	},
}
