package voice

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/livekit/protocol/auth"
	lkproto "github.com/livekit/protocol/livekit"
	lkwebhook "github.com/livekit/protocol/webhook"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

const (
	tokenTTL = 90 * time.Minute // frontend refreshes at 90 - 2 = 88min
)

// LiveKitClient wraps the LiveKit server SDK for room management and token generation.
type LiveKitClient struct {
	apiKey    string
	apiSecret string
	wsURL     string
	roomSvc   *lksdk.RoomServiceClient
}

// NewLiveKitClient creates a new LiveKit management client.
func NewLiveKitClient(apiKey, apiSecret, wsURL string) *LiveKitClient {
	// RoomServiceClient uses the HTTP/gRPC host — convert wss:// to https://
	httpHost := wsURL
	if len(httpHost) > 6 && httpHost[:6] == "wss://" {
		httpHost = "https://" + httpHost[6:]
	} else if len(httpHost) > 5 && httpHost[:5] == "ws://" {
		httpHost = "http://" + httpHost[5:]
	}

	return &LiveKitClient{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		wsURL:     wsURL,
		roomSvc:   lksdk.NewRoomServiceClient(httpHost, apiKey, apiSecret),
	}
}

// RoomName returns the canonical LiveKit room name for a guild channel.
func RoomName(guildID, channelID int64) string {
	return fmt.Sprintf("guild-%d-channel-%d", guildID, channelID)
}

// GenerateToken mints a short-lived LiveKit access token for the given participant.
func (c *LiveKitClient) GenerateToken(roomName, identity string) (string, error) {
	at := auth.NewAccessToken(c.apiKey, c.apiSecret)
	grant := &auth.VideoGrant{
		RoomJoin:             true,
		Room:                 roomName,
		CanPublish:           boolPtr(true),
		CanSubscribe:         boolPtr(true),
		CanUpdateOwnMetadata: boolPtr(true),
		CanPublishData:       boolPtr(true),
	}

	at.SetVideoGrant(grant).
		SetIdentity(identity).
		SetValidFor(tokenTTL).
		SetName(identity)

	return at.ToJWT()
}

// RemoveParticipant forcefully ejects a participant from a LiveKit room.
// Used for moderator-disconnect action.
func (c *LiveKitClient) RemoveParticipant(ctx context.Context, roomName, identity string) error {
	_, err := c.roomSvc.RemoveParticipant(ctx, &lkproto.RoomParticipantIdentity{
		Room:     roomName,
		Identity: identity,
	})
	return err
}

// ApplyParticipantPermissions updates a participant's permissions on the LiveKit server.
func (c *LiveKitClient) ApplyParticipantPermissions(ctx context.Context, roomName, identity string, canPublish, canSubscribe bool) error {
	_, err := c.roomSvc.UpdateParticipant(ctx, &lkproto.UpdateParticipantRequest{
		Room:     roomName,
		Identity: identity,
		Permission: &lkproto.ParticipantPermission{
			CanPublish:     canPublish,
			CanSubscribe:   canSubscribe,
			CanPublishData: true,
		},
	})
	return err
}

// GetParticipant retrieves detailed status of a single participant in a room.
func (c *LiveKitClient) GetParticipant(ctx context.Context, roomName, identity string) (*lkproto.ParticipantInfo, error) {
	return c.roomSvc.GetParticipant(ctx, &lkproto.RoomParticipantIdentity{
		Room:     roomName,
		Identity: identity,
	})
}

// ListParticipants retrieves the list of all active participants in a room.
func (c *LiveKitClient) ListParticipants(ctx context.Context, roomName string) ([]*lkproto.ParticipantInfo, error) {
	resp, err := c.roomSvc.ListParticipants(ctx, &lkproto.ListParticipantsRequest{
		Room: roomName,
	})
	if err != nil {
		return nil, err
	}
	return resp.Participants, nil
}

// VerifyWebhook parses and verifies a LiveKit webhook from an HTTP request.
// The key provider uses the API key/secret pair to verify the JWT signature and body checksum.
func (c *LiveKitClient) VerifyWebhook(r *http.Request) (*lkproto.WebhookEvent, error) {
	provider := auth.NewSimpleKeyProvider(c.apiKey, c.apiSecret)
	return lkwebhook.ReceiveWebhookEvent(r, provider)
}

func boolPtr(b bool) *bool { return &b }
