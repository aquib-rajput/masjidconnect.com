import { Suspense } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AudioSpacesView } from "@/components/stream/audio-spaces-view";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Audio Spaces | MasjidConnect",
  description:
    "Join live audio discussions with your Muslim community. Host and participate in Islamic talks, Q&A sessions, and community discussions.",
};

export default function AudioSpacesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }
          >
            <AudioSpacesView />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
