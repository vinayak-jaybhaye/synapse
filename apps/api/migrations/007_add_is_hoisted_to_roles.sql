-- +goose Up
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_hoisted BOOLEAN NOT NULL DEFAULT false;
-- +goose Down
ALTER TABLE roles DROP COLUMN IF EXISTS is_hoisted;
