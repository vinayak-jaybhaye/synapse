package websocket

import (
	"testing"
	"time"
)

func TestHub_ConcurrentChannelRefCounting(t *testing.T) {
	hub := NewHub(nil)

	go hub.Run()

	c1 := &Client{
		hub:        hub,
		userID:     1,
		channelIDs: []int64{100},
		send:       make(chan []byte, 10),
	}
	c2 := &Client{
		hub:        hub,
		userID:     2,
		channelIDs: []int64{100},
		send:       make(chan []byte, 10),
	}

	// 1. First client connects (0 -> 1)
	hub.Register <- c1
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.channelClients[100]) != 1 {
		t.Errorf("Expected 1 client subscribed to channel 100, got %d", len(hub.channelClients[100]))
	}
	hub.mu.RUnlock()

	// 2. Second client connects (1 -> 2)
	hub.Register <- c2
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.channelClients[100]) != 2 {
		t.Errorf("Expected 2 clients subscribed to channel 100, got %d", len(hub.channelClients[100]))
	}
	hub.mu.RUnlock()

	// 3. First client disconnects (2 -> 1)
	hub.Unregister <- c1
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.channelClients[100]) != 1 {
		t.Errorf("Expected 1 client subscribed to channel 100, got %d", len(hub.channelClients[100]))
	}
	hub.mu.RUnlock()

	// 4. Second client disconnects (1 -> 0)
	hub.Unregister <- c2
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.channelClients[100]) != 0 {
		t.Errorf("Expected 0 clients subscribed to channel 100, got %d", len(hub.channelClients[100]))
	}
	hub.mu.RUnlock()
}
