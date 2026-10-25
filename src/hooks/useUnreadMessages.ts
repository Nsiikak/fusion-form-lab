import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/** Unread chat messages for the signed-in customer or vendor (polled; cheap endpoint). */
export const useUnreadMessages = () => {
  const { user, isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !!user && user.role !== "admin";
  const { data = 0 } = useQuery({
    queryKey: ["messages", "unread"],
    queryFn: api.messages.unreadCount,
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  return enabled ? data : 0;
};
