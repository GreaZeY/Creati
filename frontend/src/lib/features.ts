export const PLANS = {
    FREE: 'free',
    CREATOR: 'creator',
    PRO: 'pro',
} as const;

export type Plan = typeof PLANS[keyof typeof PLANS];

export const CAPABILITIES = {
    CAN_USE_MAGIC_SYNC: 'can_use_magic_sync',
    CAN_USE_ADVANCED_ANALYTICS: 'can_use_advanced_analytics',
    MAX_UPLOADS: 'max_uploads_per_month',
    MAX_CONNECTED_ACCOUNTS: 'max_connected_accounts',
} as const;

export type Capability = typeof CAPABILITIES[keyof typeof CAPABILITIES];

// Default fallback entitlments (Free plan)
const DEFAULT_ENTITLEMENTS = {
    [CAPABILITIES.CAN_USE_MAGIC_SYNC]: false,
    [CAPABILITIES.CAN_USE_ADVANCED_ANALYTICS]: false,
    [CAPABILITIES.MAX_UPLOADS]: 5,
    [CAPABILITIES.MAX_CONNECTED_ACCOUNTS]: 3,
};

export const hasFeature = (userFeatures: any, capability: Capability): boolean => {
    if (!userFeatures) return DEFAULT_ENTITLEMENTS[capability] as boolean;
    return !!userFeatures[capability];
};

export const getLimit = (userFeatures: any, capability: Capability): number => {
    if (!userFeatures) return DEFAULT_ENTITLEMENTS[capability] as number;
    const val = userFeatures[capability];
    return typeof val === 'number' ? val : 0;
};
