export type PlanTier = {
  id: string;
  nameKey: string;
  nameFallback: string;
  price: number;
  descriptionKey: string;
  descriptionFallback: string;
  ctaKey: string;
  ctaFallback: string;
  highlighted?: boolean;
  features: Array<{
    key: string;
    fallback: string;
  }>;
};

export const plans: PlanTier[] = [
  {
    id: "free",
    nameKey: "plan_free_name",
    nameFallback: "Free",
    price: 0,
    descriptionKey: "plan_free_description",
    descriptionFallback: "Try Commitly on public repos with limited timelines.",
    ctaKey: "current_plan",
    ctaFallback: "Current plan",
    features: [
      { key: "plan_free_feature_1", fallback: "2 repo timelines / week" },
      { key: "plan_free_feature_2", fallback: "Guide replies within 2 minutes" },
      { key: "plan_free_feature_3", fallback: "Community support" },
    ],
  },
  {
    id: "pro",
    nameKey: "plan_pro_name",
    nameFallback: "Pro",
    price: 15,
    descriptionKey: "plan_pro_description",
    descriptionFallback: "Ship faster with unlimited timelines and saved feedback.",
    ctaKey: "join_paid_waitlist",
    ctaFallback: "Join paid plans waitlist",
    highlighted: true,
    features: [
      { key: "plan_pro_feature_1", fallback: "Unlimited repo timelines" },
      { key: "plan_pro_feature_2", fallback: "Priority guide replies" },
      { key: "plan_pro_feature_3", fallback: "Saved sessions & exports" },
      { key: "plan_pro_feature_4", fallback: "Private repo support" },
    ],
  },
  {
    id: "ultra",
    nameKey: "plan_ultra_name",
    nameFallback: "Ultra",
    price: 50,
    descriptionKey: "plan_ultra_description",
    descriptionFallback:
      "All the power of Pro with priority models and roadmap coaching.",
    ctaKey: "join_paid_waitlist",
    ctaFallback: "Join paid plans waitlist",
    features: [
      { key: "plan_ultra_feature_1", fallback: "All Pro features" },
      { key: "plan_ultra_feature_2", fallback: "Dedicated guide hours" },
      { key: "plan_ultra_feature_3", fallback: "Workspace analytics" },
      { key: "plan_ultra_feature_4", fallback: "API & webhooks" },
    ],
  },
];
