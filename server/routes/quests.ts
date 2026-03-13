import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";

const QUEST_DEFS: Record<string, { name: string; desc: string; goal: number; reward: string }> = {
  'daily_skirmish':       { name: 'Daily Skirmisher', desc: 'Win 5 skirmishes',   goal: 5,  reward: '50 Rice'  },
  'daily_boss':           { name: 'Giant Slayer',      desc: 'Defeat a boss',       goal: 1,  reward: '30 Rice'  },
  'daily_gacha':          { name: 'Summoner',           desc: 'Perform 3 summons',   goal: 3,  reward: '40 Rice'  },
  'daily_skirmish_elite': { name: 'Elite Skirmisher',  desc: 'Win 10 skirmishes',   goal: 10, reward: '100 Rice' },
  'daily_gacha_elite':    { name: 'Elite Summoner',     desc: 'Perform 5 summons',   goal: 5,  reward: '80 Rice'  },
};

export function registerQuestRoutes(app: Express) {
  app.get('/api/quests', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const quests = await storage.getQuests(userId);
    res.json(quests.map(q => {
      const def = QUEST_DEFS[q.questKey] ?? { name: 'Unknown Quest', desc: 'Unknown', goal: 1, reward: 'Unknown' };
      return { ...def, key: q.questKey, progress: q.progress, isClaimed: q.isClaimed };
    }));
  });

  app.post('/api/quests/:key/claim', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    res.json(await storage.claimQuest(userId, req.params.key));
  });
}
