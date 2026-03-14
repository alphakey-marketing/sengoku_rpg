/**
 * client/src/lib/queryClient.ts
 *
 * Phase 4: when VITE_AUTH_PROVIDER=supabase, every outgoing API request
 * attaches `Authorization: Bearer <token>` so the server-side
 * `isAuthenticated` middleware can validate the Supabase JWT.
 *
 * Replit path is completely unchanged (credentials: include, no header).
 */
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER ?? "replit";

/** Returns `{ Authorization: 'Bearer ...' }` when using Supabase, else `{}`. */
async function authHeaders(): Promise<Record<string, string>> {
  if (AUTH_PROVIDER !== "supabase") return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const extraHeaders = await authHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    // credentials: include is still needed for Replit cookie sessions
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const extraHeaders = await authHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: extraHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
