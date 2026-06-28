package main

import (
	"fmt"
	"log"
	"net/http"
	"github.com/synapse/gateway/internal/websocket"
)

func main() {
	fmt.Println("Starting Synapse WebSocket Gateway on :8081...")
	cm := websocket.NewConnectionManager()
	sm := websocket.NewSubscriptionManager()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		websocket.HandleWebSocket(w, r, cm, sm)
	})

	if err := http.ListenAndServe(":8081", nil); err != nil {
		log.Fatalf("Gateway server failed: %v", err)
	}
}
