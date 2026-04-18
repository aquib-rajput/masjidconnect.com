"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Mic, Radio, X, Plus, Clock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import type { AudioSpace } from "@/lib/stream/types";

interface CreateSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (space: AudioSpace) => void;
}

const suggestedTopics = [
  "Khutbah",
  "Quran",
  "Tafseer",
  "Fiqh",
  "Seerah",
  "Youth",
  "Sisters",
  "Ramadan",
  "Q&A",
  "Community",
  "Education",
  "Spirituality",
];

export function CreateSpaceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSpaceDialogProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [spaceType, setSpaceType] = useState<"now" | "scheduled">("now");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const addTopic = (topic: string) => {
    if (topics.length < 5 && !topics.includes(topic)) {
      setTopics([...topics, topic]);
    }
  };

  const removeTopic = (topic: string) => {
    setTopics(topics.filter((t) => t !== topic));
  };

  const addCustomTopic = () => {
    if (customTopic.trim() && topics.length < 5) {
      addTopic(customTopic.trim());
      setCustomTopic("");
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !user || !profile) return;

    setIsLoading(true);
    try {
      // Generate a unique ID for the space
      const spaceId = `space-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newSpace: AudioSpace = {
        id: spaceId,
        title: title.trim(),
        description: description.trim() || undefined,
        host_id: user.id,
        host_name: profile.full_name || profile.username || "Host",
        host_avatar: profile.avatar_url || undefined,
        status: spaceType === "now" ? "live" : "scheduled",
        scheduled_at:
          spaceType === "scheduled" && scheduledDate && scheduledTime
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : undefined,
        started_at: spaceType === "now" ? new Date().toISOString() : undefined,
        participant_count: spaceType === "now" ? 1 : 0,
        speaker_ids: [user.id],
        topics: topics.length > 0 ? topics : ["General"],
        is_recording: isRecording,
        created_at: new Date().toISOString(),
      };

      onCreated(newSpace);
      resetForm();
    } catch (error) {
      console.error("Error creating space:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTopics([]);
    setCustomTopic("");
    setScheduledDate("");
    setScheduledTime("");
    setIsRecording(false);
    setSpaceType("now");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Create Audio Space
          </DialogTitle>
          <DialogDescription>
            Start a live audio discussion with your community
          </DialogDescription>
        </DialogHeader>

        <Tabs value={spaceType} onValueChange={(v) => setSpaceType(v as "now" | "scheduled")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="now" className="gap-2">
              <Mic className="h-4 w-4" />
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
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="What's the topic of your space?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/100
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Tell people what you'll be discussing..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {description.length}/280
              </p>
            </div>

            {/* Topics */}
            <div className="space-y-2">
              <Label>Topics (up to 5)</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {topics.map((topic) => (
                  <Badge
                    key={topic}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {topic}
                    <button
                      onClick={() => removeTopic(topic)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom topic"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTopic()}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addCustomTopic}
                  disabled={topics.length >= 5}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestedTopics
                  .filter((t) => !topics.includes(t))
                  .slice(0, 8)
                  .map((topic) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10"
                      onClick={() => addTopic(topic)}
                    >
                      + {topic}
                    </Badge>
                  ))}
              </div>
            </div>

            {/* Scheduled Date/Time */}
            <TabsContent value="scheduled" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Recording Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="recording">Record Space</Label>
                <p className="text-xs text-muted-foreground">
                  Recording will be available after the space ends
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
            disabled={!title.trim() || isLoading}
            className="gap-2"
          >
            {spaceType === "now" ? (
              <>
                <Mic className="h-4 w-4" />
                Start Space
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4" />
                Schedule Space
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
