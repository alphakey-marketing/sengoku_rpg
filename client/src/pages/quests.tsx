import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Trophy, Coins, Wheat, Gem } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Quest {
  key: string;
  name: string;
  desc: string;
  goal: number;
  reward: string;
  progress: number;
  isClaimed: boolean;
}

export default function QuestsPage() {
  const { toast } = useToast();
  const { data: quests, isLoading } = useQuery<Quest[]>({ 
    queryKey: ["/api/quests"] 
  });

  const claimMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/quests/${key}/claim`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Reward Claimed!",
          description: `You received ${data.reward}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
        queryClient.invalidateQueries({ queryKey: ["/api/player"] });
      }
    }
  });

  if (isLoading) return <MainLayout><div>Loading...</div></MainLayout>;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-4xl font-display font-bold text-accent mb-2">Daily Quests</h1>
        <p className="text-muted-foreground mb-8">Complete these tasks daily to earn extra rewards.</p>

        <div className="grid gap-4">
          {quests?.map((quest) => (
            <Card key={quest.key} className="bg-card/50 border-accent/20">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{quest.name}</CardTitle>
                    <CardDescription>{quest.desc}</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-accent uppercase tracking-wider">Reward</span>
                    <p className="font-bold text-green-400">{quest.reward}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{Math.min(quest.progress, quest.goal)} / {quest.goal}</span>
                  </div>
                  <Progress value={(quest.progress / quest.goal) * 100} className="h-2" />
                  
                  <div className="flex justify-end pt-2">
                    {quest.isClaimed ? (
                      <Button disabled className="bg-zinc-800 text-zinc-500">
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Claimed
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => claimMutation.mutate(quest.key)}
                        disabled={quest.progress < quest.goal || claimMutation.isPending}
                        variant={quest.progress >= quest.goal ? "default" : "outline"}
                        className={quest.progress >= quest.goal ? "bg-accent text-black hover:bg-accent/90" : ""}
                      >
                        {quest.progress >= quest.goal ? "Claim Reward" : "In Progress"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
