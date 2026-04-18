"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Plus,
  Calendar,
  Search,
  Users,
  Clock,
  Link2,
  Copy,
  PlayCircle,
  History,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { CreateMeetingDialog } from "./create-meeting-dialog";
import { JoinMeetingDialog } from "./join-meeting-dialog";
import { MeetingCard } from "./meeting-card";
import type { VideoMeeting } from "@/lib/stream/types";
import { format } from "date-fns";
import { toast } from "sonner";

// Mock data
const mockMeetings: VideoMeeting[] = [
  {
    id: "meeting-1",
    title: "Weekly Shura Meeting",
    description: "Monthly board meeting to discuss mosque affairs",
    host_id: "user-1",
    host_name: "Brother Ahmad",
    host_avatar: "/placeholder.svg?height=40&width=40",
    mosque_name: "Masjid Al-Noor",
    type: "scheduled",
    status: "waiting",
    scheduled_at: new Date(Date.now() + 3600000).toISOString(),
    participant_count: 0,
    max_participants: 50,
    is_recording: true,
    is_private: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "meeting-2",
    title: "Online Quran Class",
    description: "Weekly tajweed and Quran recitation class",
    host_id: "user-2",
    host_name: "Ustadh Bilal",
    host_avatar: "/placeholder.svg?height=40&width=40",
    type: "scheduled",
    status: "live",
    started_at: new Date(Date.now() - 1800000).toISOString(),
    participant_count: 15,
    max_participants: 100,
    is_recording: true,
    is_private: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "meeting-3",
    title: "Youth Committee Planning",
    description: "Planning upcoming youth events and activities",
    host_id: "user-3",
    host_name: "Sister Aisha",
    host_avatar: "/placeholder.svg?height=40&width=40",
    mosque_name: "Islamic Center",
    type: "scheduled",
    status: "waiting",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    participant_count: 0,
    is_recording: false,
    is_private: true,
    passcode: "1234",
    created_at: new Date().toISOString(),
  },
];

export function VideoMeetingsView() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<VideoMeeting[]>(mockMeetings);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);

  const liveMeetings = meetings.filter((m) => m.status === "live");
  const upcomingMeetings = meetings.filter(
    (m) => m.status === "waiting" && m.scheduled_at
  );
  const myMeetings = meetings.filter((m) => m.host_id === user?.id);

  const handleJoinMeeting = (meetingId: string) => {
    router.push(`/feed/meetings/${meetingId}`);
  };

  const handleStartInstantMeeting = () => {
    const meetingId = `instant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    router.push(`/feed/meetings/${meetingId}?instant=true`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            <Video className="h-7 w-7 text-primary" />
            Video Meetings
          </h1>
          <p className="text-muted-foreground mt-1">
            Host and join video conferences with your community
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsJoinDialogOpen(true)}
            className="gap-2"
          >
            <Link2 className="h-4 w-4" />
            Join Meeting
          </Button>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2"
          >
            <Plus className="h-5 w-5" />
            New Meeting
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={<PlayCircle className="h-6 w-6" />}
          title="Start Instant Meeting"
          description="Start a meeting right now"
          onClick={handleStartInstantMeeting}
          variant="primary"
        />
        <QuickActionCard
          icon={<Calendar className="h-6 w-6" />}
          title="Schedule Meeting"
          description="Plan a meeting for later"
          onClick={() => setIsCreateDialogOpen(true)}
        />
        <QuickActionCard
          icon={<Link2 className="h-6 w-6" />}
          title="Join with Code"
          description="Enter a meeting code"
          onClick={() => setIsJoinDialogOpen(true)}
        />
        <QuickActionCard
          icon={<History className="h-6 w-6" />}
          title="View Recordings"
          description="Access past recordings"
          onClick={() => toast.info("Recordings feature coming soon!")}
        />
      </div>

      {/* Live Now Section */}
      {liveMeetings.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Now
              <Badge variant="secondary" className="ml-2">
                {liveMeetings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {liveMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search meetings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="upcoming" className="gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-2">
            <Video className="h-4 w-4" />
            Live
          </TabsTrigger>
          <TabsTrigger value="my-meetings" className="gap-2">
            <Users className="h-4 w-4" />
            My Meetings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingMeetings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
              title="No upcoming meetings"
              description="Schedule a meeting to connect with your community."
              action={
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Meeting
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {liveMeetings.length === 0 ? (
            <EmptyState
              icon={<Video className="h-12 w-12 text-muted-foreground" />}
              title="No live meetings"
              description="There are no live meetings right now. Start one!"
              action={
                <Button onClick={handleStartInstantMeeting} className="gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Start Meeting
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-meetings" className="mt-6">
          {myMeetings.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12 text-muted-foreground" />}
              title="No meetings yet"
              description="You haven't created any meetings yet."
              action={
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Meeting
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                  isHost
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateMeetingDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={(meeting) => {
          setMeetings((prev) => [meeting, ...prev]);
          if (meeting.type === "instant") {
            router.push(`/feed/meetings/${meeting.id}`);
          }
        }}
      />
      <JoinMeetingDialog
        open={isJoinDialogOpen}
        onOpenChange={setIsJoinDialogOpen}
        onJoin={(meetingId) => handleJoinMeeting(meetingId)}
      />
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg hover:border-primary/40",
        variant === "primary" &&
          "bg-gradient-to-br from-primary/10 to-transparent border-primary/30"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div
          className={cn(
            "rounded-full w-12 h-12 flex items-center justify-center mb-3",
            variant === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {icon}
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
