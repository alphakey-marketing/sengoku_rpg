/**
 * client/src/components/layout/app-sidebar.tsx
 *
 * Progressive-disclosure sidebar.
 *
 * - Reads player.currentChapter from the /api/player endpoint.
 * - Unlocked items are rendered as normal links.
 * - Locked items are rendered as greyed-out entries with a tooltip
 *   explaining which chapter unlocks them — visible but unreachable,
 *   so players always know what's coming next.
 */
import { Link, useLocation } from "wouter";
import {
  Home,
  Users,
  Sword,
  Sparkles,
  Map,
  LogOut,
  Tent,
  Zap,
  ShieldAlert,
  BookOpen,
  Rabbit,
  Lock,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { usePlayer } from "@/hooks/use-game";
import { NAV_ITEMS, isNavUnlocked } from "@/lib/nav-unlock";
import type { NavItem } from "@/lib/nav-unlock";

// Map icon name strings → lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  Users,
  Sword,
  Sparkles,
  Map,
  Tent,
  Zap,
  ShieldAlert,
  BookOpen,
  Rabbit,
};

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { data: player } = usePlayer();

  // Fall back to 0 (story-only mode) while player data is loading
  const currentChapter = player?.currentChapter ?? 0;

  function renderNavItem(item: NavItem) {
    const IconComponent = ICON_MAP[item.icon] ?? Home;
    const unlocked = isNavUnlocked(item, currentChapter);
    const isActive = location === item.url;

    if (!unlocked) {
      return (
        <SidebarMenuItem key={item.title}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center gap-3 px-3 py-2 my-1 mx-2 rounded-md
                             text-muted-foreground/40 cursor-not-allowed select-none"
                  aria-disabled="true"
                >
                  <Lock size={16} className="text-muted-foreground/30" />
                  <span className="font-medium text-sm">{item.title}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-[180px]">
                🔒 {item.unlockHint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className={`
            my-1 mx-2 rounded-md transition-all duration-300
            ${
              isActive
                ? "bg-primary/20 text-accent border border-primary/30 shadow-[inset_4px_0_0_rgba(220,38,38,0.8)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }
          `}
        >
          <Link href={item.url} className="flex items-center gap-3 px-3 py-2 w-full">
            <IconComponent
              size={18}
              className={isActive ? "text-accent" : "text-muted-foreground"}
            />
            <span className="font-medium">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/95 backdrop-blur-md">
      <SidebarHeader className="p-4 border-b border-border/50 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 text-primary shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <Tent size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-wider text-foreground text-shadow-glow">
              SENGOKU
            </h2>
            <p className="text-xs text-muted-foreground font-medium">RPG Chronicles</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold tracking-widest text-accent/70 uppercase mt-4 mb-2 px-4">
            Campaign Trail
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4 bg-black/20">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">
                {user.firstName || "Daimyo"}
                {/* Title suffix (Phase C2) will appear here once earned */}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email || "guest@sengoku.jp"}
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Logout"
              data-testid="button-logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
