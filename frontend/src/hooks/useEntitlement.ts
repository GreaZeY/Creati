import { useQuery } from '@tanstack/react-query';
import { paymentsAPI } from '@/lib/api';
import { hasFeature, type Capability } from '@/lib/features';

export function useEntitlement() {
    const { data: subscription, isLoading } = useQuery({
        queryKey: ['subscription'],
        queryFn: async () => {
            // We can cache this heavily or rely on React Query's default
            const resp = await paymentsAPI.getSubscription();
            return resp.data.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false
    });

    const canUse = (capability: Capability): boolean => {
        if (isLoading || !subscription) return false; // Default to false while loading/error
        // The backend returns pre-calculated features in subscription.features
        // But our checks on frontend might want to use the local helper if we trust the plan name
        // However, backend source of truth is best.
        // Let's rely on the plan name and the shared features.ts logic for consistency 
        // OR rely on what backend sent in 'features' map if we want backend control.

        // The payments.go handler sends:
        // entitlements["canUseMagicSync"] = features.HasFeature(sub.Plan, features.CanUseMagicSync)
        // So we can use subscription.features directly.

        if (subscription.features && subscription.features[capability] !== undefined) {
            return !!subscription.features[capability];
        }

        // Fallback to local logic if needed (e.g. optimistic updates)
        return hasFeature(null, capability); // This returns default (false/limits)
    };

    const limit = (capability: Capability): number => {
        if (isLoading || !subscription) return 0;

        if (subscription.features && subscription.features[capability] !== undefined) {
            return Number(subscription.features[capability]);
        }
        return 0;
    };

    return {
        plan: subscription?.plan || 'free',
        isLoading,
        canUse,
        limit
    };
}
