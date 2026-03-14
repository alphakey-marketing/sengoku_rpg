export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// Redirect to the Supabase email login page
export function redirectToLogin(
  toast?: (options: {
    title: string;
    description: string;
    variant: string;
  }) => void
) {
  if (toast) {
    toast({
      title: "Session expired",
      description: "Please sign in again to continue.",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
}
