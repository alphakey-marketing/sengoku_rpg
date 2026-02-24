import { useQuery, useMutation } from "@tanstack/react-query";
import { Quarters, Structure } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Coins, Wheat, Building2 } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { usePlayer } from "@/hooks/use-game";
import { useEffect, useState } from "react";

export default function QuartersPage() {
  const { toast } = useToast();
  const { data: player } = usePlayer();
  const { data: quarters, isLoading } = useQuery<Quarters & { structures: Structure[] }>({
    queryKey: ["/api/quarters"],
  });

  const [pendingRice, setPendingRice] = useState(0);

  useEffect(() => {
    if (!quarters) return;
    
    const calculateRice = () => {
      const structs = quarters.structures || [];
      const merchantGuilds = structs.filter(s => s.type === 'merchant_guild');
      const now = new Date();
      const lastCollect = quarters.lastIncomeAt ? new Date(quarters.lastIncomeAt) : new Date();
      const hoursPassed = Math.floor((now.getTime() - lastCollect.getTime()) / (1000 * 60 * 60));
      
      if (hoursPassed < 1) {
        setPendingRice(0);
        return;
      }

      const totalBonusPct = merchantGuilds.reduce((sum, s) => sum + s.incomeBonus, 0);
      const baseRicePerHour = 10;
      const riceGained = Math.floor(hoursPassed * baseRicePerHour * (1 + totalBonusPct / 100));
      setPendingRice(riceGained);
    };

    calculateRice();
    const interval = setInterval(calculateRice, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [quarters]);

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quarters/build", {
        type: "merchant_guild",
        positionX: 0,
        positionY: 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quarters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player"] });
      toast({ title: "Structure Built", description: "Merchant Guild established!" });
    },
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quarters/collect");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quarters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player"] });
      const amount = data.riceGained ?? 0;
      toast({ title: "Income Collected", description: `Gained ${amount} Rice!` });
    },
  });

  if (isLoading) return <MainLayout><div>Loading Quarters...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Daimyo's Quarters
          </h1>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/30 px-4 py-2 rounded-lg">
              <Coins size={18} className="text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-[10px] text-yellow-300 uppercase font-bold tracking-wider">Gold</span>
                <span className="text-lg font-bold text-white leading-none">{player?.gold?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Available Slots: {quarters?.availableSlots}</p>
              <p>Structures Built: {quarters?.structures.length}</p>
              <Button 
                className="mt-4 w-full" 
                onClick={() => buildMutation.mutate()}
                disabled={buildMutation.isPending || (quarters?.structures.length || 0) >= (quarters?.availableSlots || 0) || (player?.gold || 0) < 500}
              >
                <Coins className="mr-2 w-4 h-4" /> Build Merchant Guild (500 Gold)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passive Income</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Total Bonus: {quarters?.structures.reduce((acc, s) => acc + s.incomeBonus, 0)}%</p>
              <p className="text-sm text-muted-foreground mt-2">
                Base Rate: 10 Rice/hour
              </p>
              <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wheat className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">Available to Collect:</span>
                </div>
                <span className="text-lg font-bold text-green-400">{pendingRice} Rice</span>
              </div>
              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => collectMutation.mutate()}
                disabled={collectMutation.isPending || pendingRice < 1}
              >
                <Wheat className="mr-2 w-4 h-4" /> Collect Rice
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quarters?.structures.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-2">🏯</div>
                <h3 className="font-bold capitalize">{s.type.replace('_', ' ')}</h3>
                <p className="text-sm text-muted-foreground">Tier {s.tier} | Level {s.level}</p>
                <p className="text-sm text-green-600">+{s.incomeBonus}% Rice</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
