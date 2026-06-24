package snowflake

import (
	"fmt"
	"sync"

	"github.com/bwmarrin/snowflake"
)

var (
	node *snowflake.Node
	once sync.Once
)

// InitNode initializes the global Snowflake node worker with a specific ID.
func InitNode(nodeID int64) error {
	var err error
	once.Do(func() {
		node, err = snowflake.NewNode(nodeID)
	})
	if err != nil {
		return fmt.Errorf("failed to initialize snowflake node: %w", err)
	}
	return nil
}

// GenerateID returns a unique 64-bit Snowflake ID.
func GenerateID() int64 {
	if node == nil {
		// Fallback node initialization if InitNode wasn't called (useful for unit tests)
		var err error
		node, err = snowflake.NewNode(1)
		if err != nil {
			panic(fmt.Sprintf("failed to initialize default snowflake node: %v", err))
		}
	}
	return node.Generate().Int64()
}
