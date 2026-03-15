/**
 * client/src/lib/queryClient.ts
 *
 * Handles auth headers for every outgoing API request.
 *
 * Two modes, controlled by VITE_AUTH_PROVIDER env var:
 *
 *   supabase (default / production)
 *     — attaches `Authorization: Bearer <token>` from the active Supabase session.
 *
 *   dev (local development)
 *     — attaches `x-dev-user-id: <uuid>` from localStorage.
 *       No Supabase session required — the server auto-creates the user row.
 */
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { IS_DEV_AUTH, getOrCreateDevUserId } from "./devAuth";

/** Returns the correct auth headers depending on the active auth provider. */
async function authHeaders(): Promise<Record<string, string>> {
  if (IS_DEV_AUTH) {
    return { "x-dev-user-id": getOrCreateDevUserId() };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Throws a descriptive error if the response is not 2xx.
 * Clones the response before reading the body so the original stream
 * remains unconsumed and the caller can still call .json() / .text().
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.clone().text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Authenticated fetch wrapper.
 * Returns the parsed JSON body directly so callers never need to call
 * .json() themselves.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<any> {
  const extraHeaders = await authHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return null;
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
      queryFn: getQueryFn({ on401: "returnNull" }),
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
