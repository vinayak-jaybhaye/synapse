package audit

import "context"

// EntryBuilder provides a fluent builder pattern for logging audit records.
type EntryBuilder struct {
	svc    Service
	params LogParams
}

// NewEntry initializes a new fluent EntryBuilder attached to the service.
func (s *service) NewEntry() *EntryBuilder {
	return &EntryBuilder{
		svc: s,
		params: LogParams{
			Metadata: make(map[string]any),
		},
	}
}

func (b *EntryBuilder) Guild(guildID int64) *EntryBuilder {
	b.params.GuildID = guildID
	return b
}

func (b *EntryBuilder) Actor(actor ActorSnapshot) *EntryBuilder {
	b.params.Actor = actor
	return b
}

func (b *EntryBuilder) ActorID(ctx context.Context, actorID int64) *EntryBuilder {
	if b.svc != nil {
		b.params.Actor = b.svc.GetActorSnapshot(ctx, actorID)
	} else {
		b.params.Actor = ActorSnapshot{ID: &actorID}
	}
	return b
}

func (b *EntryBuilder) ActorUser(id int64, username, displayName, avatarKey string) *EntryBuilder {
	b.params.Actor = ActorSnapshot{
		ID:          &id,
		Username:    username,
		DisplayName: displayName,
		AvatarKey:   avatarKey,
	}
	return b
}

func (b *EntryBuilder) Action(action Action) *EntryBuilder {
	b.params.Action = action
	return b
}

func (b *EntryBuilder) Target(target Target) *EntryBuilder {
	b.params.Target = target
	return b
}

func (b *EntryBuilder) TargetResource(tType TargetType, id *int64, display string) *EntryBuilder {
	b.params.Target = Target{
		Type:    tType,
		ID:      id,
		Display: display,
	}
	return b
}

func (b *EntryBuilder) Reason(reason string) *EntryBuilder {
	if reason != "" {
		b.params.Reason = &reason
	}
	return b
}

func (b *EntryBuilder) ReasonPtr(reason *string) *EntryBuilder {
	b.params.Reason = reason
	return b
}

func (b *EntryBuilder) Changes(changes Changes) *EntryBuilder {
	b.params.Changes = changes
	return b
}

func (b *EntryBuilder) Metadata(key string, val any) *EntryBuilder {
	if b.params.Metadata == nil {
		b.params.Metadata = make(map[string]any)
	}
	b.params.Metadata[key] = val
	return b
}

func (b *EntryBuilder) MetadataMap(meta map[string]any) *EntryBuilder {
	if meta != nil {
		if b.params.Metadata == nil {
			b.params.Metadata = make(map[string]any)
		}
		for k, v := range meta {
			b.params.Metadata[k] = v
		}
	}
	return b
}

// Log executes service logging with the built parameters.
func (b *EntryBuilder) Log(ctx context.Context) error {
	return b.svc.Log(ctx, b.params)
}
