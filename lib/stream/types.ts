export type SpaceStatus = "scheduled" | "live" | "ended";

export interface AudioSpace {
  id: string;
  title: string;
  description?: string;
  host_id: string;
  host_name: string;
  host_avatar?: string;
  mosque_id?: string;
  mosque_name?: string;
  status: SpaceStatus;
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  participant_count: number;
  speaker_ids: string[];
  topics: string[];
  is_recording: boolean;
  created_at: string;
}

export interface VideoMeeting {
  id: string;
  title: string;
  description?: string;
  host_id: string;
  host_name: string;
  host_avatar?: string;
  mosque_id?: string;
  mosque_name?: string;
  type: "instant" | "scheduled";
  status: "waiting" | "live" | "ended";
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  participant_count: number;
  max_participants?: number;
  is_recording: boolean;
  is_private: boolean;
  passcode?: string;
  created_at: string;
}

export interface Participant {
  id: string;
  user_id: string;
  name: string;
  avatar?: string;
  role: "host" | "speaker" | "listener";
  is_muted: boolean;
  is_speaking: boolean;
  joined_at: string;
}
