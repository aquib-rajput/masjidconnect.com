-- Audio Spaces Table (Twitter/X Spaces style)
CREATE TABLE IF NOT EXISTS audio_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_call_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mosque_id UUID REFERENCES mosques(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  max_speakers INTEGER DEFAULT 10,
  is_recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,
  listener_count INTEGER DEFAULT 0,
  speaker_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Meetings Table (Zoom style)
CREATE TABLE IF NOT EXISTS video_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_call_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mosque_id UUID REFERENCES mosques(id) ON DELETE SET NULL,
  meeting_type TEXT NOT NULL DEFAULT 'instant' CHECK (meeting_type IN ('instant', 'scheduled', 'recurring')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  max_participants INTEGER DEFAULT 100,
  is_recording_enabled BOOLEAN DEFAULT false,
  recording_url TEXT,
  is_waiting_room_enabled BOOLEAN DEFAULT false,
  passcode TEXT,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Space Participants Table
CREATE TABLE IF NOT EXISTS space_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES audio_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('host', 'co_host', 'speaker', 'listener')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT true,
  hand_raised BOOLEAN DEFAULT false,
  UNIQUE(space_id, user_id)
);

-- Meeting Participants Table
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES video_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'co_host', 'participant')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_video_on BOOLEAN DEFAULT true,
  is_audio_on BOOLEAN DEFAULT true,
  is_screen_sharing BOOLEAN DEFAULT false,
  UNIQUE(meeting_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE audio_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

-- Audio Spaces Policies
CREATE POLICY "Anyone can view live or scheduled spaces" ON audio_spaces
  FOR SELECT USING (status IN ('live', 'scheduled'));

CREATE POLICY "Hosts can manage their spaces" ON audio_spaces
  FOR ALL USING (auth.uid() = host_id);

CREATE POLICY "Authenticated users can create spaces" ON audio_spaces
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Video Meetings Policies
CREATE POLICY "Participants can view meetings they're invited to" ON video_meetings
  FOR SELECT USING (
    auth.uid() = host_id OR 
    EXISTS (SELECT 1 FROM meeting_participants WHERE meeting_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Hosts can manage their meetings" ON video_meetings
  FOR ALL USING (auth.uid() = host_id);

CREATE POLICY "Authenticated users can create meetings" ON video_meetings
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Space Participants Policies
CREATE POLICY "Anyone can view space participants" ON space_participants
  FOR SELECT USING (true);

CREATE POLICY "Users can join/leave spaces" ON space_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Hosts can manage participants" ON space_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM audio_spaces WHERE id = space_id AND host_id = auth.uid())
  );

-- Meeting Participants Policies
CREATE POLICY "Meeting members can view participants" ON meeting_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM video_meetings WHERE id = meeting_id AND (host_id = auth.uid() OR EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id = meeting_id AND mp.user_id = auth.uid())))
  );

CREATE POLICY "Users can join/leave meetings" ON meeting_participants
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Hosts can manage meeting participants" ON meeting_participants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM video_meetings WHERE id = meeting_id AND host_id = auth.uid())
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_spaces_status ON audio_spaces(status);
CREATE INDEX IF NOT EXISTS idx_audio_spaces_host ON audio_spaces(host_id);
CREATE INDEX IF NOT EXISTS idx_audio_spaces_mosque ON audio_spaces(mosque_id);
CREATE INDEX IF NOT EXISTS idx_audio_spaces_scheduled ON audio_spaces(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_video_meetings_status ON video_meetings(status);
CREATE INDEX IF NOT EXISTS idx_video_meetings_host ON video_meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_mosque ON video_meetings(mosque_id);
CREATE INDEX IF NOT EXISTS idx_video_meetings_scheduled ON video_meetings(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_space_participants_space ON space_participants(space_id);
CREATE INDEX IF NOT EXISTS idx_space_participants_user ON space_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);

-- Enable Realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE audio_spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE video_meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE space_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_participants;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_audio_spaces_updated_at
  BEFORE UPDATE ON audio_spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_video_meetings_updated_at
  BEFORE UPDATE ON video_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
