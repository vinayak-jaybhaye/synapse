-- Migration 004: Outbox partitioning and LISTEN/NOTIFY trigger

-- 1. Add partition_key for horizontal scaling of the outbox relay
ALTER TABLE outbox_events
ADD COLUMN partition_key SMALLINT NOT NULL DEFAULT 0;

-- 2. Index optimized for the worker polling query:
-- SELECT * FROM outbox_events WHERE status = 0 AND partition_key = $1 ORDER BY id LIMIT 100
CREATE INDEX idx_outbox_worker_poll
ON outbox_events (partition_key, status, id);

-- 3. Trigger to NOTIFY the relay immediately upon new outbox events
CREATE OR REPLACE FUNCTION notify_outbox_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the 'outbox_new' channel with the partition_key as the payload
  PERFORM pg_notify('outbox_new', NEW.partition_key::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_notify
AFTER INSERT ON outbox_events
FOR EACH ROW EXECUTE FUNCTION notify_outbox_event();
