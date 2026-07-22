# Database Schema
Refer to `apps/api/migrations/001_initial_schema.sql` for the full primary schema.
Contains `users`, `guilds`, `guild_members`, `channels`, `direct_conversations`, `messages`, `roles`, and `outbox_events`.

```mermaid
erDiagram
    users ||--o{ guild_members : belongs_to
    users ||--o{ messages : authors
    
    guilds ||--o{ guild_members : contains
    guilds ||--o{ channels : contains
    guilds ||--o{ roles : defines
    
    channels ||--o{ messages : contains
    
    messages ||--o{ message_attachments : has
    messages ||--o{ message_reactions : has
    
    users }|--|{ direct_conversations : participates_in
    channels ||--|| direct_conversations : maps_to
```
