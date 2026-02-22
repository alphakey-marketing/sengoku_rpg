import { z } from 'zod';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
};

const BattleResultSchema = z.object({
  victory: z.boolean(),
  experienceGained: z.number(),
  goldGained: z.number(),
  riceGained: z.number().optional(),
  equipmentDropped: z.array(z.any()).optional(),
  petDropped: z.any().optional(),
  horseDropped: z.any().optional(),
  transformationDropped: z.any().optional(),
  equipmentExpGained: z.number().optional(),
  logs: z.array(z.string()),
  playerTeam: z.any().optional(),
  enemyTeam: z.any().optional(),
});

export const api = {
  player: {
    get: {
      method: 'GET' as const,
      path: '/api/player' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
    fullStatus: {
      method: 'GET' as const,
      path: '/api/player/status' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized },
    },
  },
  companions: {
    list: {
      method: 'GET' as const,
      path: '/api/companions' as const,
      responses: { 200: z.array(z.any()), 401: errorSchemas.unauthorized },
    },
    setParty: {
      method: 'POST' as const,
      path: '/api/companions/party' as const,
      input: z.object({ companionIds: z.array(z.number()) }),
      responses: { 200: z.array(z.any()), 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    }
  },
  equipment: {
    list: {
      method: 'GET' as const,
      path: '/api/equipment' as const,
      responses: { 200: z.array(z.any()), 401: errorSchemas.unauthorized },
    },
    equip: {
      method: 'POST' as const,
      path: '/api/equipment/:id/equip' as const,
      input: z.object({
        equippedToId: z.number().nullable(),
        equippedToType: z.enum(['player', 'companion']),
      }),
      responses: { 200: z.any(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
    unequip: {
      method: 'POST' as const,
      path: '/api/equipment/:id/unequip' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
    recycle: {
      method: 'POST' as const,
      path: '/api/equipment/:id/recycle' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
    upgrade: {
      method: 'POST' as const,
      path: '/api/equipment/:id/upgrade' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
  },
  pets: {
    list: {
      method: 'GET' as const,
      path: '/api/pets' as const,
      responses: { 200: z.array(z.any()), 401: errorSchemas.unauthorized },
    },
    setActive: {
      method: 'POST' as const,
      path: '/api/pets/:id/activate' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
  },
  horses: {
    list: {
      method: 'GET' as const,
      path: '/api/horses' as const,
      responses: { 200: z.array(z.any()), 401: errorSchemas.unauthorized },
    },
    setActive: {
      method: 'POST' as const,
      path: '/api/horses/:id/activate' as const,
      responses: { 200: z.any(), 401: errorSchemas.unauthorized, 404: errorSchemas.notFound },
    },
  },
  transformations: {
    list: {
      method: 'GET' as const,
      path: '/api/transformations' as const,
      responses: { 200: z.array(z.any()), 401: errorSchemas.unauthorized },
    },
  },
  battle: {
    field: {
      method: 'POST' as const,
      path: '/api/battle/field' as const,
      input: z.object({ locationId: z.number() }),
      responses: { 200: BattleResultSchema, 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    },
    boss: {
      method: 'POST' as const,
      path: '/api/battle/boss' as const,
      input: z.object({ locationId: z.number() }),
      responses: { 200: BattleResultSchema, 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    },
    specialBoss: {
      method: 'POST' as const,
      path: '/api/battle/special-boss' as const,
      input: z.object({ locationId: z.number() }),
      responses: { 200: BattleResultSchema, 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    },
  },
  gacha: {
    pull: {
      method: 'POST' as const,
      path: '/api/gacha/pull' as const,
      responses: { 200: z.any(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    },
    pullEquipment: {
      method: 'POST' as const,
      path: '/api/gacha/pull-equipment' as const,
      responses: { 200: z.any(), 400: errorSchemas.validation, 401: errorSchemas.unauthorized },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
