"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRealtimePosts } from "@/lib/realtime";
import { ConnectionStatus } from "@/components/realtime/connection-status";
import useSWR, { mutate } from "swr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  ImagePlus,
  X,
  Send,
  Loader2,
  Trash2,
  Flag,
  Bookmark,
  BookmarkCheck,
  Users,
  Rss,
  MessageSquare,
  Search,
  Settings,
  Bell,
  Camera,
  MapPin,
  Calendar,
  Link as LinkIcon,
  CheckCircle,
  ChevronRight,
  UserPlus,
  Building2,
  BookOpen,
  Shield,
  User,
  Globe,
  Briefcase,
  Edit,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Types
interface Post {
  id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
    role?: string;
  };
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface CommunityMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
  role: string;
  last_seen_at: string | null;
  created_at: string;
  bio: string | null;
  location: string | null;
  posts_count?: number;
  followers_count?: number;
}

interface Conversation {
  id: string;
  name: string | null;
  type: "direct" | "group" | "broadcast";
  image_url: string | null;
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
  participants: CommunityMember[];
}

// SWR fetcher
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

// Custom hook for posts with optimistic updates
function usePosts(userId?: string) {
  const supabase = createClient();

  const { data, error, isLoading, mutate: mutatePosts } = useSWR(
    "posts-feed",
    async () => {
      const { data: posts, error } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!author_id(id, full_name, avatar_url, username, role)
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (userId && posts) {
        const { data: likes } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", userId);

        const likedPostIds = new Set(likes?.map((l) => l.post_id) || []);
        return posts.map((post) => ({
          ...post,
          is_liked: likedPostIds.has(post.id),
        }));
      }

      return posts || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    posts: data || [],
    isLoading,
    error,
    mutatePosts,
  };
}

// Custom hook for community members
function useCommunityMembers() {
  const supabase = createClient();

  const { data, error, isLoading } = useSWR(
    "community-members",
    async () => {
      const { data: members, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username, role, last_seen_at, created_at, bio, location")
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) throw error;
      return members || [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  const onlineMembers = useMemo(() => {
    if (!data) return [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return data.filter((m) => m.last_seen_at && m.last_seen_at > fiveMinutesAgo);
  }, [data]);

  return {
    members: data || [],
    onlineMembers,
    isLoading,
    error,
  };
}

// Main Social Feed Component
export function SocialFeed() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("feed");
  const [selectedProfile, setSelectedProfile] = useState<CommunityMember | null>(null);
  const supabase = createClient();

  // Update last seen
  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [user, supabase]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Sidebar - User Profile (Desktop) */}
      <aside className="hidden lg:col-span-3 lg:block">
        <div className="sticky top-20 space-y-4">
          <UserProfileCard profile={profile} user={user} />
          <QuickLinks />
        </div>
      </aside>

      {/* Main Content */}
      <section className="lg:col-span-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="feed" className="gap-2">
              <Rss className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="explore" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Explore</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-0">
            <FeedContent user={user} profile={profile} />
          </TabsContent>

          <TabsContent value="messages" className="mt-0">
            <MessagesContent user={user} />
          </TabsContent>

          <TabsContent value="explore" className="mt-0">
            <ExploreContent onViewProfile={setSelectedProfile} />
          </TabsContent>
        </Tabs>
      </section>

      {/* Right Sidebar - Online Members */}
      <aside className="hidden lg:col-span-3 lg:block">
        <div className="sticky top-20 space-y-4">
          <OnlineMembersCard onViewProfile={setSelectedProfile} />
          <CommunityMembersCard onViewProfile={setSelectedProfile} />
        </div>
      </aside>

      {/* Profile Sheet */}
      {selectedProfile && (
        <ProfileSheet
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
}

// User Profile Card Component
function UserProfileCard({ profile, user }: { profile: any; user: any }) {
  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Sign in to see your profile</p>
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
      <CardContent className="pt-0 px-4 pb-4">
        <div className="relative -mt-10 mb-3">
          <Avatar className="h-20 w-20 ring-4 ring-background">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
              {profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold truncate">{profile?.full_name || "User"}</h3>
          {profile?.role === "imam" || profile?.role === "shura" ? (
            <CheckCircle className="h-4 w-4 text-primary fill-primary/20 flex-shrink-0" />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          @{profile?.username || user.email?.split("@")[0]}
        </p>

        {profile?.bio && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{profile.bio}</p>
        )}

        <div className="flex items-center gap-4 mt-4 text-sm">
          <div>
            <span className="font-semibold">{profile?.posts_count || 0}</span>
            <span className="text-muted-foreground ml-1">posts</span>
          </div>
          <div>
            <span className="font-semibold">{profile?.followers_count || 0}</span>
            <span className="text-muted-foreground ml-1">followers</span>
          </div>
        </div>

        <Button variant="outline" className="w-full mt-4" size="sm" asChild>
          <Link href="/profile">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Quick Links Card
function QuickLinks() {
  const links = [
    { icon: Bookmark, label: "Saved Posts", href: "/saved" },
    { icon: Calendar, label: "Events", href: "/events" },
    { icon: Building2, label: "Mosques", href: "/mosques" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <link.icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{link.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Feed Content Component
function FeedContent({ user, profile }: { user: any; profile: any }) {
  const { posts, isLoading, mutatePosts } = usePosts(user?.id);
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  
  // Realtime subscription for posts using centralized service
  useRealtimePosts(
    useCallback(() => mutatePosts(), [mutatePosts]),
    useCallback(() => mutatePosts(), [mutatePosts]),
    useCallback(() => mutatePosts(), [mutatePosts])
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreatePost = async () => {
    if (!user || (!newPostContent.trim() && !selectedImage)) return;

    setPosting(true);
    try {
      let imageUrl = null;

      if (selectedImage) {
        const formData = new FormData();
        formData.append("file", selectedImage);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");
        const { url } = await uploadRes.json();
        imageUrl = url;
      }

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: newPostContent.trim(),
        image_url: imageUrl,
      });

      if (error) throw error;

      setNewPostContent("");
      clearImage();
      toast.success("Post created!");
      mutatePosts();
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) {
      toast.error("Please sign in to like posts");
      return;
    }

    // Optimistic update
    mutatePosts(
      (posts: Post[] | undefined) =>
        posts?.map((p) =>
          p.id === postId
            ? {
                ...p,
                is_liked: !isLiked,
                likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1,
              }
            : p
        ),
      false
    );

    try {
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      }
    } catch (error) {
      mutatePosts(); // Revert on error
    }
  };

  const loadComments = async (postId: string) => {
    if (loadingComments.has(postId)) return;

    setLoadingComments((prev) => new Set(prev).add(postId));

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments((prev) => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
      if (!comments[postId]) loadComments(postId);
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComments[postId]?.trim()) return;

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          author_id: user.id,
          content: newComments[postId].trim(),
        })
        .select(`*, author:profiles!author_id(id, full_name, avatar_url)`)
        .single();

      if (error) throw error;

      setComments((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data],
      }));

      setNewComments((prev) => ({ ...prev, [postId]: "" }));
      mutatePosts();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", user.id);

      if (error) throw error;
      toast.success("Post deleted");
      mutatePosts();
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Post */}
      {user && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback>
                  {profile?.full_name?.charAt(0) || user.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3">
                <Textarea
                  placeholder="Share something with the community..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                {imagePreview && (
                  <div className="relative inline-block">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={200}
                      height={200}
                      className="rounded-lg object-cover"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -right-2 -top-2 h-6 w-6"
                      onClick={clearImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Photo
                  </Button>
                  <Button
                    onClick={handleCreatePost}
                    disabled={posting || (!newPostContent.trim() && !selectedImage)}
                    size="sm"
                  >
                    {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Rss className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post: Post) => (
          <PostCard
            key={post.id}
            post={post}
            user={user}
            profile={profile}
            onLike={handleLike}
            onDelete={handleDeletePost}
            onToggleComments={toggleComments}
            expandedComments={expandedComments}
            comments={comments}
            loadingComments={loadingComments}
            newComments={newComments}
            setNewComments={setNewComments}
            onAddComment={handleAddComment}
          />
        ))
      )}
    </div>
  );
}

// Post Card Component
function PostCard({
  post,
  user,
  profile,
  onLike,
  onDelete,
  onToggleComments,
  expandedComments,
  comments,
  loadingComments,
  newComments,
  setNewComments,
  onAddComment,
}: {
  post: Post;
  user: any;
  profile: any;
  onLike: (postId: string, isLiked: boolean) => void;
  onDelete: (postId: string) => void;
  onToggleComments: (postId: string) => void;
  expandedComments: Set<string>;
  comments: Record<string, Comment[]>;
  loadingComments: Set<string>;
  newComments: Record<string, string>;
  setNewComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddComment: (postId: string) => void;
}) {
  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "imam":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "shura":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.author?.avatar_url || ""} />
            <AvatarFallback>{post.author?.full_name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold leading-none">{post.author?.full_name || "Anonymous"}</p>
              {post.author?.role && post.author.role !== "user" && (
                <Badge variant="secondary" className={cn("text-xs h-5", getRoleBadgeColor(post.author.role))}>
                  {post.author.role}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Bookmark className="mr-2 h-4 w-4" />
              Save
            </DropdownMenuItem>
            {user?.id === post.author?.id ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(post.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem>
                <Flag className="mr-2 h-4 w-4" />
                Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        {post.content && <p className="whitespace-pre-wrap">{post.content}</p>}
        {post.image_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg">
            <Image src={post.image_url} alt="Post image" fill className="object-cover" />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex w-full items-center gap-2 border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLike(post.id, !!post.is_liked)}
            className={post.is_liked ? "text-red-500" : ""}
          >
            <Heart className={`mr-1.5 h-4 w-4 ${post.is_liked ? "fill-current" : ""}`} />
            {post.likes_count}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onToggleComments(post.id)}>
            <MessageCircle className="mr-1.5 h-4 w-4" />
            {post.comments_count}
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="mr-1.5 h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Comments Section */}
        {expandedComments.has(post.id) && (
          <div className="w-full space-y-3 border-t pt-3">
            {loadingComments.has(post.id) ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                {comments[post.id]?.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author?.avatar_url || ""} />
                      <AvatarFallback>{comment.author?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg bg-muted p-2.5">
                      <p className="text-sm font-semibold">{comment.author?.full_name || "Anonymous"}</p>
                      <p className="text-sm">{comment.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}

                {user && (
                  <div className="flex gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback>{profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 gap-2">
                      <Input
                        placeholder="Write a comment..."
                        value={newComments[post.id] || ""}
                        onChange={(e) =>
                          setNewComments((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onAddComment(post.id);
                          }
                        }}
                      />
                      <Button size="icon" onClick={() => onAddComment(post.id)} disabled={!newComments[post.id]?.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// Messages Content Component (Simplified for tab integration)
function MessagesContent({ user }: { user: any }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/conversations");
        const data = await res.json();
        if (data.conversations) {
          setConversations(data.conversations);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Sign in to view messages</p>
          <Button asChild>
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <h3 className="font-semibold">Messages</h3>
          <Button size="sm" asChild>
            <Link href="/messages">
              Open Full View
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No conversations yet</p>
              <Button variant="link" asChild>
                <Link href="/messages">Start a conversation</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.slice(0, 5).map((conv) => {
                const otherParticipant = conv.participants.find((p) => p.id !== user.id);
                const displayName = conv.name || otherParticipant?.full_name || "Unknown";
                const avatarUrl = conv.image_url || otherParticipant?.avatar_url;

                return (
                  <Link
                    key={conv.id}
                    href="/messages"
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar>
                      <AvatarImage src={avatarUrl || ""} />
                      <AvatarFallback>
                        {conv.type === "direct" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{displayName}</p>
                        {conv.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-[20px] justify-center">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-sm text-muted-foreground truncate">{conv.last_message.content}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Explore Content Component
function ExploreContent({ onViewProfile }: { onViewProfile: (profile: CommunityMember) => void }) {
  const { members, isLoading } = useCommunityMembers();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(query) ||
        m.username?.toLowerCase().includes(query) ||
        m.bio?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No members found</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <MemberListItem key={member.id} member={member} onClick={() => onViewProfile(member)} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Online Members Card
function OnlineMembersCard({ onViewProfile }: { onViewProfile: (profile: CommunityMember) => void }) {
  const { onlineMembers, isLoading } = useCommunityMembers();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Online Now
          </h3>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? "..." : onlineMembers.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : onlineMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No members online</p>
        ) : (
          <div className="space-y-2">
            {onlineMembers.slice(0, 5).map((member) => (
              <button
                key={member.id}
                onClick={() => onViewProfile(member)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar_url || ""} />
                    <AvatarFallback className="text-xs">
                      {member.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{member.username || "user"}</p>
                </div>
              </button>
            ))}
            {onlineMembers.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full text-xs">
                View all {onlineMembers.length} online
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Community Members Card
function CommunityMembersCard({ onViewProfile }: { onViewProfile: (profile: CommunityMember) => void }) {
  const { members, isLoading } = useCommunityMembers();

  const featuredMembers = useMemo(() => {
    if (!members.length) return [];
    // Show imams, shura, and active members first
    const sorted = [...members].sort((a, b) => {
      const roleOrder = { imam: 0, shura: 1, admin: 2, user: 3 };
      return (roleOrder[a.role as keyof typeof roleOrder] || 3) - (roleOrder[b.role as keyof typeof roleOrder] || 3);
    });
    return sorted.slice(0, 6);
  }, [members]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Community
          </h3>
          <Badge variant="secondary" className="text-xs">
            {isLoading ? "..." : members.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {featuredMembers.map((member) => (
              <MemberCard key={member.id} member={member} onClick={() => onViewProfile(member)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Member Card Component
function MemberCard({ member, onClick }: { member: CommunityMember; onClick: () => void }) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "imam":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "shura":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const isOnline = member.last_seen_at && member.last_seen_at > fiveMinutesAgo;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url || ""} />
          <AvatarFallback className="text-xs">
            {member.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{member.full_name}</span>
          {member.role && member.role !== "user" && (
            <Badge variant="secondary" className={cn("text-xs h-5", getRoleBadgeColor(member.role))}>
              {member.role}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">@{member.username || "user"}</p>
      </div>
    </button>
  );
}

// Member List Item Component
function MemberListItem({ member, onClick }: { member: CommunityMember; onClick: () => void }) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "imam":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "shura":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const isOnline = member.last_seen_at && member.last_seen_at > fiveMinutesAgo;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={member.avatar_url || ""} />
          <AvatarFallback>
            {member.full_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{member.full_name}</span>
          {member.role && member.role !== "user" && (
            <Badge variant="secondary" className={cn("text-xs", getRoleBadgeColor(member.role))}>
              {member.role}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">@{member.username || "user"}</p>
        {member.bio && <p className="text-sm text-muted-foreground truncate mt-1">{member.bio}</p>}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

// Profile Sheet Component
function ProfileSheet({
  profile,
  onClose,
  currentUserId,
}: {
  profile: CommunityMember;
  onClose: () => void;
  currentUserId?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);
  const supabase = createClient();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "imam":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "shura":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "imam":
        return <BookOpen className="h-4 w-4" />;
      case "shura":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const isOnline = profile.last_seen_at && profile.last_seen_at > fiveMinutesAgo;

  const handleStartChat = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to start a conversation");
      return;
    }

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "direct",
          participant_ids: [profile.id],
        }),
      });

      if (res.ok) {
        toast.success("Conversation started");
        onClose();
        window.location.href = "/messages";
      }
    } catch (error) {
      toast.error("Failed to start conversation");
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {/* Cover & Avatar */}
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 rounded-lg" />
          <div className="px-4 -mt-12">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-background">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {profile.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              {isOnline && (
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-green-500 ring-2 ring-background" />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{profile.full_name}</h2>
              {(profile.role === "imam" || profile.role === "shura") && (
                <CheckCircle className="h-5 w-5 text-primary fill-primary/20" />
              )}
            </div>
            <p className="text-muted-foreground">@{profile.username || "user"}</p>

            {profile.role && profile.role !== "user" && (
              <Badge variant="secondary" className={cn("mt-2 gap-1.5", getRoleBadgeColor(profile.role))}>
                {getRoleIcon(profile.role)}
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </Badge>
            )}

            {profile.bio && <p className="mt-4 text-sm leading-relaxed">{profile.bio}</p>}

            {profile.location && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {profile.location}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div>
                <span className="font-semibold">{profile.posts_count || 0}</span>
                <span className="text-muted-foreground ml-1">posts</span>
              </div>
              <div>
                <span className="font-semibold">{profile.followers_count || 0}</span>
                <span className="text-muted-foreground ml-1">followers</span>
              </div>
            </div>

            {/* Actions */}
            {currentUserId && currentUserId !== profile.id && (
              <div className="flex gap-2 mt-6">
                <Button className="flex-1" onClick={handleStartChat}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  className="flex-1"
                  onClick={() => setIsFollowing(!isFollowing)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
