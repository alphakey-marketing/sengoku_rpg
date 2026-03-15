/**
 * story.tsx — page shell
 * Routes between ChapterSelectHub (chapter list) and StoryPlayer
 * (scene renderer). All logic and constants live in components/story/.
 */
import { useParams, useLocation } from "wouter";
import { usePlayer } from "@/hooks/use-game";
import { ChapterSelectHub } from "@/components/story/ChapterSelectHub";
import { StoryPlayer }      from "@/components/story/StoryPlayer";

export default function StoryPage() {
  const params = useParams<{ chapterId?: string }>();
  const [, navigate] = useLocation();

  const { data: player, isLoading: playerLoading } = usePlayer();
  const currentChapter = player?.currentChapter ?? 0;

  const hasChapterParam    = !!params.chapterId;
  const chapterIdFromParam = params.chapterId ? parseInt(params.chapterId, 10) : null;

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (hasChapterParam && chapterIdFromParam) {
    return <StoryPlayer chapterId={chapterIdFromParam} />;
  }

  if (currentChapter >= 1) {
    return (
      <ChapterSelectHub
        currentChapter={currentChapter}
        onSelectChapter={(id) => navigate(`/story/${id}`)}
      />
    );
  }

  return <StoryPlayer chapterId={1} />;
}
