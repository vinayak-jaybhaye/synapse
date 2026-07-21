package events

import (
	"fmt"
	"sync"
)

// EventBus is an in-memory publish-subscribe bus for domain events.
type EventBus interface {
	Publish(event interface{})
	Subscribe(eventType interface{}, handler func(event interface{}))
}

type eventBus struct {
	mu       sync.RWMutex
	handlers map[string][]func(interface{})
}

func NewEventBus() EventBus {
	return &eventBus{
		handlers: make(map[string][]func(interface{})),
	}
}

func getEventName(event interface{}) string {
	return fmt.Sprintf("%T", event)
}

func (b *eventBus) Publish(event interface{}) {
	name := getEventName(event)
	b.mu.RLock()
	handlers := b.handlers[name]
	b.mu.RUnlock()

	for _, handler := range handlers {
		// execute handlers synchronously or asynchronously?
		// For a simple synchronous domain event bus:
		handler(event)
	}
}

func (b *eventBus) Subscribe(eventType interface{}, handler func(event interface{})) {
	name := getEventName(eventType)
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[name] = append(b.handlers[name], handler)
}
