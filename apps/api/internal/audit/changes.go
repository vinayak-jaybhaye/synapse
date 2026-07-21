package audit

import "reflect"

// ChangesBuilder builds a map of before/after field changes cleanly without reflection magic.
type ChangesBuilder struct {
	changes Changes
}

// NewChanges initializes a new ChangesBuilder.
func NewChanges() *ChangesBuilder {
	return &ChangesBuilder{changes: make(Changes)}
}

// Add appends a field diff to the builder if oldVal and newVal are not equal.
func (b *ChangesBuilder) Add(field string, oldVal, newVal any) *ChangesBuilder {
	if !reflect.DeepEqual(oldVal, newVal) {
		b.changes[field] = ChangeValue{
			Old: oldVal,
			New: newVal,
		}
	}
	return b
}

// AddPtr compares pointers and adds the diff if they differ.
func (b *ChangesBuilder) AddPtr(field string, oldVal, newVal *string) *ChangesBuilder {
	var oldStr, newStr string
	if oldVal != nil {
		oldStr = *oldVal
	}
	if newVal != nil {
		newStr = *newVal
	}
	if oldVal == nil && newVal == nil {
		return b
	}
	if (oldVal == nil) != (newVal == nil) || oldStr != newStr {
		b.changes[field] = ChangeValue{
			Old: oldVal,
			New: newVal,
		}
	}
	return b
}

// Build returns the final Changes map, or nil if no field differences were found.
func (b *ChangesBuilder) Build() Changes {
	if len(b.changes) == 0 {
		return nil
	}
	return b.changes
}
