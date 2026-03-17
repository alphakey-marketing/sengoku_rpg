/**
 * story.tsx — page shell
 * Routes between ChapterSelectHub (chapter list) and StoryPlayer
 * (scene renderer). All logic and constants live in components/story/.
 *
 * Sprint 5 (4a): adds a two-tab bar (Chronicles | Grants) when the
 * chapter hub is shown.  The Grants tab renders GrantsChronicleTab.
 * Tab state is driven by the `tab` query-string parameter so the
 * Grants view is bookmarkable and linkable from the nav badge dot.
 */
import { useParams, useLocation, useSearch } from "wouter";
import { usePlayer } from "@/hooks/use-game";
import { ChapterSelectHub } from "@/components/story/ChapterSelectHub";
import { StoryPlayer }      from "@/components/story/StoryPlayer";
import { GrantsChronicleTab } from "@/components/story/GrantsChronicleTab";
import { Scroll, Sparkles } from "lucide-react";

export default function StoryPage() {
  const params = useParams<{ chapterId?: string }>();
  const [, navigate]  = useLocation();
  const search        = useSearch();

  const { data: player, isLoading: playerLoading } = usePlayer();
  const currentChapter = player?.currentChapter ?? 0;

  const hasChapterParam    = !!params.chapterId;
  const chapterIdFromParam = params.chapterId ? parseInt(params.chapterId, 10) : null;

  // Active tab from ?tab= query param; default 'chronicles'
  const activeTab = new URLSearchParams(search).get("tab") === "grants"
    ? "grants"
    : "chronicles";

  if (playerLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-stone-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  // Always show StoryPlayer when a chapter URL param is present
  if (hasChapterParam && chapterIdFromParam) {
    return <StoryPlayer chapterId={chapterIdFromParam} />;
  }

  // Chapter 0 — boot directly into Chapter 1 (first-play)
  if (currentChapter < 1) {
    return <StoryPlayer chapterId={1} />;
  }

  // Hub view — chapter select + grants tab
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-950 via-zinc-900 to-black">
      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <div className="border-b border-white/8 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-0">
            <TabButton
              label="Chronicles"
              icon={<Scroll size={13} />}
              active={activeTab === "chronicles"}
              onClick={() => navigate("/story")}
            />
            <TabButton
              label="Grants"
              icon={<Sparkles size={13} />}
              active={activeTab === "grants"}
              onClick={() => navigate("/story?tab=grants")}
            />
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {activeTab === "grants" ? (
          <GrantsChronicleTab />
        ) : (
          <ChapterSelectHub
            currentChapter={currentChapter}
            onSelectChapter={(id) => navigate(`/story/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

// ── TabButton ─────────────────────────────────────────────────────────────

function TabButton({
  label, icon, active, onClick,
}: {
  label:   string;
  icon:    React.ReactNode;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
        active
          ? "border-amber-400 text-amber-300"
          : "border-transparent text-stone-500 hover:text-stone-300",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
