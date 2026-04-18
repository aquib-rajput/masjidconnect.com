"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  Radio,
  Users,
  Plus,
  Calendar,
  Search,
  Clock,
  ChevronRight,
  Headphones,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { CreateSpaceDialog } from "./create-space-dialog";
import { SpaceCard } from "./space-card";
import type { AudioSpace } from "@/lib/stream/types";

// Mock data for demonstration
const mockSpaces: AudioSpace[] = [
  {
    id: "space-1",
    title: "Friday Khutbah Discussion",
    description: "Open discussion about this week's Friday sermon topics",
    host_id: "user-1",
    host_name: "Imam Abdullah",
    host_avatar: "/placeholder.svg?height=40&width=40",
    mosque_name: "Masjid Al-Noor",
    status: "live",
    started_at: new Date(Date.now() - 1800000).toISOString(),
    participant_count: 47,
    speaker_ids: ["user-1", "user-2", "user-3"],
    topics: ["Khutbah", "Islamic Knowledge", "Q&A"],
    is_recording: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "space-2",
    title: "Youth Halaqa: Building Good Habits",
    description: "Weekly youth discussion on personal development in Islam",
    host_id: "user-4",
    host_name: "Brother Yusuf",
    host_avatar: "/placeholder.svg?height=40&width=40",
    mosque_name: "Islamic Center",
    status: "live",
    started_at: new Date(Date.now() - 3600000).toISOString(),
    participant_count: 23,
    speaker_ids: ["user-4", "user-5"],
    topics: ["Youth", "Self-improvement", "Habits"],
    is_recording: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "space-3",
    title: "Sisters Circle: Ramadan Preparation",
    description: "Sisters-only discussion on preparing for Ramadan",
    host_id: "user-6",
    host_name: "Sister Fatima",
    host_avatar: "/placeholder.svg?height=40&width=40",
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    participant_count: 0,
    speaker_ids: ["user-6"],
    topics: ["Sisters", "Ramadan", "Spirituality"],
    is_recording: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "space-4",
    title: "Quranic Tafseer Session",
    description: "Weekly study of Surah Al-Baqarah",
    host_id: "user-7",
    host_name: "Sheikh Ahmed",
    host_avatar: "/placeholder.svg?height=40&width=40",
    mosque_name: "Masjid At-Taqwa",
    status: "scheduled",
    scheduled_at: new Date(Date.now() + 172800000).toISOString(),
    participant_count: 0,
    speaker_ids: ["user-7"],
    topics: ["Quran", "Tafseer", "Education"],
    is_recording: true,
    created_at: new Date().toISOString(),
  },
];

export function AudioSpacesView() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<AudioSpace[]>(mockSpaces);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("live");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const liveSpaces = spaces.filter((s) => s.status === "live");
  const scheduledSpaces = spaces.filter((s) => s.status === "scheduled");
  const mySpaces = spaces.filter(
    (s) => s.host_id === user?.id || s.speaker_ids.includes(user?.id || "")
  );

  const filteredSpaces = spaces.filter(
    (space) =>
      space.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      space.topics.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const handleJoinSpace = (spaceId: string) => {
    router.push(`/feed/spaces/${spaceId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            <Radio className="h-7 w-7 text-primary" />
            Audio Spaces
          </h1>
          <p className="text-muted-foreground mt-1">
            Join live audio discussions with your community
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Start a Space
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search spaces by title or topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Live Now Section */}
      {liveSpaces.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Now
              <Badge variant="secondary" className="ml-2">
                {liveSpaces.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {liveSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onJoin={() => handleJoinSpace(space.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="live" className="gap-2">
            <Headphones className="h-4 w-4" />
            Live
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Calendar className="h-4 w-4" />
            Scheduled
          </TabsTrigger>
          <TabsTrigger value="my-spaces" className="gap-2">
            <Mic className="h-4 w-4" />
            My Spaces
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-6">
          {liveSpaces.length === 0 ? (
            <EmptyState
              icon={<Radio className="h-12 w-12 text-muted-foreground" />}
              title="No live spaces"
              description="There are no live audio spaces right now. Start one to engage your community!"
              action={
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Start a Space
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onJoin={() => handleJoinSpace(space.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          {scheduledSpaces.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-12 w-12 text-muted-foreground" />}
              title="No scheduled spaces"
              description="Schedule a space in advance to let your community know when to join."
              action={
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule a Space
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {scheduledSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onJoin={() => handleJoinSpace(space.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-spaces" className="mt-6">
          {mySpaces.length === 0 ? (
            <EmptyState
              icon={<Mic className="h-12 w-12 text-muted-foreground" />}
              title="No spaces yet"
              description="You haven't hosted or spoken in any spaces yet."
              action={
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Start Your First Space
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mySpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  onJoin={() => handleJoinSpace(space.id)}
                  isHost={space.host_id === user?.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Trending Topics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Trending Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              "Khutbah",
              "Ramadan",
              "Quran",
              "Youth",
              "Sisters",
              "Tafseer",
              "Fiqh",
              "Seerah",
              "Q&A",
              "Community",
            ].map((topic) => (
              <Badge
                key={topic}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setSearchQuery(topic)}
              >
                {topic}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Space Dialog */}
      <CreateSpaceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={(space) => {
          setSpaces((prev) => [space, ...prev]);
          router.push(`/feed/spaces/${space.id}`);
        }}
      />
    </div>
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
