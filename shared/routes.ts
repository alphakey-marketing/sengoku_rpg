import { z } from 'zod';
import { insertCompanionSchema, insertEquipmentSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// Response models
const UserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  level: z.number(),
  experience: z.number(),
  gold: z.number(),
  rice: z.number(),
  attack: z.number(),
  defense: z.number(),
  currentLocationId: z.number(),
});

const BattleResultSchema = z.object({
  victory: z.boolean(),
  experienceGained: z.number(),
  goldGained: z.number(),
  equipmentDropped: z.array(z.any()).optional(), // Will be Equipment
  logs: z.array(z.string()),
});

const GachaResultSchema = z.object({
  companion: z.any(), // Will be Companion
});

export const api = {
  player: {
    get: {
      method: 'GET' as const,
      path: '/api/player' as const,
      responses: {
        200: z.any(), // User
        401: errorSchemas.unauthorized,
      },
    },
  },
  companions: {
    list: {
      method: 'GET' as const,
      path: '/api/companions' as const,
      responses: {
        200: z.array(z.any()), // Companion[]
        401: errorSchemas.unauthorized,
      },
    },
    setParty: {
      method: 'POST' as const,
      path: '/api/companions/party' as const,
      input: z.object({
        companionIds: z.array(z.number()),
      }),
      responses: {
        200: z.array(z.any()), // Companion[]
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    }
  },
  equipment: {
    list: {
      method: 'GET' as const,
      path: '/api/equipment' as const,
      responses: {
        200: z.array(z.any()), // Equipment[]
        401: errorSchemas.unauthorized,
      },
    },
    equip: {
      method: 'POST' as const,
      path: '/api/equipment/:id/equip' as const,
      input: z.object({
        equippedToId: z.number().nullable(), // null for main char, ID for companion
      }),
      responses: {
        200: z.any(), // Equipment
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    }
  },
  battle: {
    field: {
      method: 'POST' as const,
      path: '/api/battle/field' as const,
      input: z.object({
        locationId: z.number(),
      }),
      responses: {
        200: BattleResultSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    boss: {
      method: 'POST' as const,
      path: '/api/battle/boss' as const,
      input: z.object({
        locationId: z.number(),
      }),
      responses: {
        200: BattleResultSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  gacha: {
    pull: {
      method: 'POST' as const,
      path: '/api/gacha/pull' as const,
      responses: {
        200: GachaResultSchema,
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
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
