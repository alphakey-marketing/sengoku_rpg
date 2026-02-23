import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Home from "@/pages/home";
import Party from "@/pages/party";
import EquipmentPage from "@/pages/equipment";
import GachaPage from "@/pages/gacha";
import MapPage from "@/pages/map";
import StablePage from "@/pages/stable";

import PetsPage from "@/pages/pets";

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={LandingPage} />
      <Route path="/" component={Home} />
      <Route path="/party" component={Party} />
      <Route path="/equipment" component={EquipmentPage} />
      <Route path="/pets" component={PetsPage} />
      <Route path="/gacha" component={GachaPage} />
      <Route path="/map" component={MapPage} />
      <Route path="/stable" component={StablePage} />
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
