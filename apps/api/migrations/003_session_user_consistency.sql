-- Migration 003: Enforce sessions.user_id consistency with devices.user_id
-- Postgres does not support correlated subqueries in CHECK constraints,
-- so we use a BEFORE INSERT/UPDATE trigger instead.
-- This is a belt-and-suspenders guard; the application already derives
-- session.user_id from the device row at insert time (not from a caller parameter).

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

CREATE TRIGGER trg_session_user_consistency
BEFORE INSERT OR UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION check_session_user_matches_device();
