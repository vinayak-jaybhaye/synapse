-- +goose Up
-- Migration 003: Enforce sessions.user_id consistency with devices.user_id

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION check_session_user_matches_device()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id != (SELECT user_id FROM devices WHERE id = NEW.device_id) THEN
    RAISE EXCEPTION
      'sessions.user_id (%) must match devices.user_id for device_id=%',
      NEW.user_id, NEW.device_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_session_user_consistency ON sessions;

CREATE TRIGGER trg_session_user_consistency
BEFORE INSERT OR UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION check_session_user_matches_device();

-- +goose Down
DROP TRIGGER IF EXISTS trg_session_user_consistency ON sessions;
DROP FUNCTION IF EXISTS check_session_user_matches_device();
