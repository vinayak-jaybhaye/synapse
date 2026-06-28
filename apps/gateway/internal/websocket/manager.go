package websocket

import "net/http"

type MessageType string

const (
	Ping              MessageType = "PING"
	Pong              MessageType = "PONG"
	ChatMessage       MessageType = "CHAT_MESSAGE"
	SubscribeChannel  MessageType = "SUBSCRIBE_CHANNEL"
	UnsubscribeChannel MessageType = "UNSUBSCRIBE_CHANNEL"
)

type ConnectionManager struct {
	// tracks: user -> websocket connection
}

func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{}
}

type SubscriptionManager struct {
	// tracks: channel -> connected users
}

func NewSubscriptionManager() *SubscriptionManager {
	return &SubscriptionManager{}
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request, cm *ConnectionManager, sm *SubscriptionManager) {
	// Upgrade connection and handle messages here
	w.Write([]byte("WebSocket handler placeholder"))
}
