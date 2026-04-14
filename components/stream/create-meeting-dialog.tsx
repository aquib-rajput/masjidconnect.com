"use client";

import { useState } from "react";
import { Calendar, Video, Lock, Globe, Users, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import type { VideoMeeting } from "@/lib/stream/types";

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (meeting: VideoMeeting) => void;
}

export function CreateMeetingDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateMeetingDialogProps) {
  const { user, profile } = useAuth();
  const [meetingType, setMeetingType] = useState<"instant" | "scheduled">("instant");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<VideoMeeting | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!user || !profile) return;
    if (meetingType === "scheduled" && !title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    setIsLoading(true);
    try {
      const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newMeeting: VideoMeeting = {
        id: meetingId,
        title: title.trim() || "Instant Meeting",
        description: description.trim() || undefined,
        host_id: user.id,
        host_name: profile.full_name || profile.username || "Host",
        host_avatar: profile.avatar_url || undefined,
        type: meetingType,
        status: meetingType === "instant" ? "live" : "waiting",
        scheduled_at:
          meetingType === "scheduled" && scheduledDate && scheduledTime
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : undefined,
        started_at: meetingType === "instant" ? new Date().toISOString() : undefined,
        participant_count: meetingType === "instant" ? 1 : 0,
        max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
        is_recording: isRecording,
        is_private: isPrivate,
        passcode: isPrivate && passcode ? passcode : undefined,
        created_at: new Date().toISOString(),
      };

      setCreatedMeeting(newMeeting);
      
      if (meetingType === "instant") {
        onCreated(newMeeting);
        onOpenChange(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Failed to create meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmScheduled = () => {
    if (createdMeeting) {
      onCreated(createdMeeting);
      onOpenChange(false);
      resetForm();
      toast.success("Meeting scheduled successfully!");
    }
  };

  const copyMeetingLink = () => {
    if (createdMeeting) {
      const url = `${window.location.origin}/feed/meetings/${createdMeeting.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Meeting link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledDate("");
    setScheduledTime("");
    setIsPrivate(true);
    setPasscode("");
    setIsRecording(false);
    setMaxParticipants("");
    setCreatedMeeting(null);
    setMeetingType("instant");
  };

  // Show meeting details after scheduling
  if (createdMeeting && meetingType === "scheduled") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Meeting Scheduled
            </DialogTitle>
            <DialogDescription>
              Your meeting has been created. Share the link with participants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h3 className="font-semibold">{createdMeeting.title}</h3>
              {createdMeeting.scheduled_at && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(createdMeeting.scheduled_at).toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/feed/meetings/${createdMeeting.id}`}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={copyMeetingLink}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {createdMeeting.passcode && (
              <p className="text-sm text-muted-foreground">
                Passcode: <span className="font-mono font-bold">{createdMeeting.passcode}</span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleConfirmScheduled}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Create Video Meeting
          </DialogTitle>
          <DialogDescription>
            Start an instant meeting or schedule one for later
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={meetingType}
          onValueChange={(v) => setMeetingType(v as "instant" | "scheduled")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="instant" className="gap-2">
              <Video className="h-4 w-4" />
              Start Now
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Meeting Title {meetingType === "scheduled" && "*"}
              </Label>
              <Input
                id="title"
                placeholder={
                  meetingType === "instant"
                    ? "Optional title..."
                    : "Enter meeting title"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this meeting about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            {/* Scheduled Date/Time */}
            <TabsContent value="scheduled" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPrivate ? (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="space-y-0.5">
                  <Label htmlFor="private">Private Meeting</Label>
                  <p className="text-xs text-muted-foreground">
                    {isPrivate
                      ? "Only people with the link can join"
                      : "Anyone can discover and join"}
                  </p>
                </div>
              </div>
              <Switch
                id="private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            {/* Passcode */}
            {isPrivate && (
              <div className="space-y-2">
                <Label htmlFor="passcode">Passcode (optional)</Label>
                <Input
                  id="passcode"
                  placeholder="Enter a passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  maxLength={10}
                />
              </div>
            )}

            {/* Max Participants */}
            <div className="space-y-2">
              <Label htmlFor="max" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Max Participants (optional)
              </Label>
              <Input
                id="max"
                type="number"
                placeholder="Unlimited"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                min={2}
                max={1000}
              />
            </div>

            {/* Recording Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="recording">Record Meeting</Label>
                <p className="text-xs text-muted-foreground">
                  Save a recording of this meeting
                </p>
              </div>
              <Switch
                id="recording"
                checked={isRecording}
                onCheckedChange={setIsRecording}
              />
            </div>
          </div>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isLoading || (meetingType === "scheduled" && !title.trim())}
            className="gap-2"
          >
            {meetingType === "instant" ? (
              <>
                <Video className="h-4 w-4" />
                Start Meeting
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Schedule Meeting
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
