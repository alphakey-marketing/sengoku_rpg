import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/auth-guard";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
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
      {/* Public routes — no auth required */}
      <Route path="/landing" component={LandingPage} />
      <Route path="/login" component={LoginPage} />

      {/* Protected routes — <AuthGuard> redirects to /login if not signed in */}
      <Route path="/">
        <AuthGuard><Home /></AuthGuard>
      </Route>
      <Route path="/party">
        <AuthGuard><Party /></AuthGuard>
      </Route>
      <Route path="/equipment">
        <AuthGuard><EquipmentPage /></AuthGuard>
      </Route>
      <Route path="/gear">
        <AuthGuard><GearPage /></AuthGuard>
      </Route>
      <Route path="/pets">
        <AuthGuard><PetsPage /></AuthGuard>
      </Route>
      <Route path="/gacha">
        <AuthGuard><GachaPage /></AuthGuard>
      </Route>
      <Route path="/map">
        <AuthGuard><MapPage /></AuthGuard>
      </Route>
      <Route path="/stable">
        <AuthGuard><StablePage /></AuthGuard>
      </Route>
      <Route path="/quests">
        <AuthGuard><QuestsPage /></AuthGuard>
      </Route>
      <Route path="/story">
        <AuthGuard><StoryPage /></AuthGuard>
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
