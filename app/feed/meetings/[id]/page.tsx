import { Suspense } from "react";
import { VideoMeetingRoom } from "@/components/stream/video-meeting-room";
import { Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ instant?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Video Meeting | MasjidConnect`,
    description: "Join the video meeting",
  };
}

export default async function VideoMeetingRoomPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { instant } = await searchParams;
  
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Joining meeting...</p>
          </div>
        </div>
      }
    >
      <VideoMeetingRoom meetingId={id} isInstant={instant === "true"} />
    </Suspense>
  );
}
