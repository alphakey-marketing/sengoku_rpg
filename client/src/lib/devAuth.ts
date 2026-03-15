/**
 * client/src/lib/devAuth.ts
 *
 * DEV AUTH — only active when VITE_AUTH_PROVIDER=dev.
 *
 * Behaviour:
 *   - Each browser profile gets its own random UUID stored in localStorage.
 *   - Opening a new private/incognito window = brand-new UUID = fresh game.
 *   - Clearing site data resets the UUID on next load.
 *   - The UUID is sent with every API request as `x-dev-user-id` header.
 *
 * Nothing in this file runs in production (guarded by IS_DEV_AUTH constant).
 */

const DEV_USER_KEY = "sengoku_dev_user_id";

/** Returns the stored dev UUID, or generates + stores a new one. */
export function getOrCreateDevUserId(): string {
  let id = localStorage.getItem(DEV_USER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEV_USER_KEY, id);
  }
  return id;
}

/**
 * Clears the stored dev UUID from localStorage.
 * On next page load a new UUID will be generated → fresh game state.
 */
export function resetDevUser(): void {
  localStorage.removeItem(DEV_USER_KEY);
}

/** True when the current browser is using dev auth. */
export const IS_DEV_AUTH =
  (import.meta.env.VITE_AUTH_PROVIDER as string | undefined) === "dev";
