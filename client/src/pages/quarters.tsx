import { useQuery, useMutation } from "@tanstack/react-query";
import { Quarters, Structure } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Coins, Wheat, Home } from "lucide-react";

export default function QuartersPage() {
  const { toast } = useToast();
  const { data: quarters, isLoading } = useQuery<Quarters & { structures: Structure[] }>({
    queryKey: ["/api/quarters"],
  });

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
      toast({ title: "Income Collected", description: `Gained ${data.riceGained} Rice!` });
    },
  });

  if (isLoading) return <div>Loading Quarters...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Home className="w-6 h-6" /> Daimyo's Quarters
      </h1>

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
              disabled={buildMutation.isPending || (quarters?.structures.length || 0) >= (quarters?.availableSlots || 0)}
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
            <Button 
              variant="outline" 
              className="mt-4 w-full"
              onClick={() => collectMutation.mutate()}
              disabled={collectMutation.isPending}
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
  );
}
