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
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { title: "Dojo (Home)", url: "/", icon: Home },
  { title: "War Council", url: "/stable", icon: Users },
  { title: "Battle Prep (Gear)", url: "/gear", icon: ShieldAlert },
  { title: "Armory (Equipment)", url: "/equipment", icon: Sword },
  { title: "Shrine (Gacha)", url: "/gacha", icon: Zap },
  { title: "Campaign (Map)", url: "/map", icon: Map },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/95 backdrop-blur-md">
      <SidebarHeader className="p-4 border-b border-border/50 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 text-primary shadow-[0_0_15px_rgba(220,38,38,0.3)]">
            <Tent size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-wider text-foreground text-shadow-glow">SENGOKU</h2>
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
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`
                        my-1 mx-2 rounded-md transition-all duration-300
                        ${isActive
                          ? 'bg-primary/20 text-accent border border-primary/30 shadow-[inset_4px_0_0_rgba(220,38,38,0.8)]'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                        }
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2 w-full">
                        <item.icon size={18} className={isActive ? "text-accent" : "text-muted-foreground"} />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/50 p-4 bg-black/20">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground">{user.firstName || 'Daimyo'}</span>
              <span className="text-xs text-muted-foreground">{user.email || 'guest@sengoku.jp'}</span>
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
