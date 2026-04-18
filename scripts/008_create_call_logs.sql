-- Create call logs table for tracking call history
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL UNIQUE,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  initiator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ringing', 'connecting', 'connected', 'ended', 'failed', 'rejected', 'missed')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_initiator ON call_logs(initiator_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs(call_id);

-- Enable RLS
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own call logs
CREATE POLICY "Users can view their own call logs" ON call_logs
  FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert call logs they initiated" ON call_logs
  FOR INSERT
  WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update call logs they are part of" ON call_logs
  FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_call_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_call_logs_updated_at ON call_logs;
CREATE TRIGGER trigger_call_logs_updated_at
  BEFORE UPDATE ON call_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_call_logs_updated_at();
