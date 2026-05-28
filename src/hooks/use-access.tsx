import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccess, type MyAccess } from "@/lib/access.functions";

const EMPTY: MyAccess = { roles: [], isAdmin: false, hasDeepAnalysis: false, hasMonitorSubscription: false, diagnosisCredits: 0 };

export function useAccess() {
  const { user } = useAuth();
  const fn = useServerFn(getMyAccess);
  const q = useQuery({
    queryKey: ["my-access", user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
  });
  return {
    access: q.data ?? EMPTY,
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
