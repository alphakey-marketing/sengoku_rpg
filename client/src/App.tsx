import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/auth-guard";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import AuthCallback from "@/pages/auth-callback";
import Home from "@/pages/home";
import Party from "@/pages/party";
import EquipmentPage from "@/pages/equipment";
import GearPage from "@/pages/gear";
import GachaPage from "@/pages/gacha";
import MapPage from "@/pages/map";
import StablePage from "@/pages/stable";
import QuestsPage from "@/pages/quests";
import PetsPage from "@/pages/pets";
import StoryPage from "@/pages/story";

function Router() {
  return (
    <Switch>
      {/* ── Public routes — no auth required ───────────────────────────── */}
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/callback" component={AuthCallback} />

      {/* ── Protected routes ────────────────────────────────────────────── */}
      {/*
        Every protected route passes its path to <AuthGuard> so the guard
        can exempt /story/* from the "new player → redirect to /story" logic
        and avoid an infinite redirect loop.
      */}

      {/* Story is ALWAYS the first destination for new players (chapter 0) */}
      <Route path="/story">
        <AuthGuard routePath="/story"><StoryPage /></AuthGuard>
      </Route>

      {/* Deep-link to a specific chapter, e.g. /story/2 */}
      <Route path="/story/:chapterId">
        <AuthGuard routePath="/story/:chapterId"><StoryPage /></AuthGuard>
      </Route>

      {/* All other routes unlock progressively via currentChapter */}
      <Route path="/">
        <AuthGuard routePath="/"><Home /></AuthGuard>
      </Route>
      <Route path="/party">
        <AuthGuard routePath="/party"><Party /></AuthGuard>
      </Route>
      <Route path="/equipment">
        <AuthGuard routePath="/equipment"><EquipmentPage /></AuthGuard>
      </Route>
      <Route path="/gear">
        <AuthGuard routePath="/gear"><GearPage /></AuthGuard>
      </Route>
      <Route path="/pets">
        <AuthGuard routePath="/pets"><PetsPage /></AuthGuard>
      </Route>
      <Route path="/gacha">
        <AuthGuard routePath="/gacha"><GachaPage /></AuthGuard>
      </Route>
      <Route path="/map">
        <AuthGuard routePath="/map"><MapPage /></AuthGuard>
      </Route>
      <Route path="/stable">
        <AuthGuard routePath="/stable"><StablePage /></AuthGuard>
      </Route>
      <Route path="/quests">
        <AuthGuard routePath="/quests"><QuestsPage /></AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
