export type PlanTier = {
  id: string
  name: string
  price: number
  description: string
  cta: string
  highlighted?: boolean
  features: string[]
}

export const plans: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Try commitly on public repos with limited timelines.",
    cta: "Current plan",
    features: [
      "2 repo timelines / week",
      "Guide replies within 2 minutes",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 18,
    description: "Ship faster with unlimited timelines and saved feedback.",
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited repo timelines",
      "Priority guide replies",
      "Saved sessions & exports",
      "Private repo support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: 79,
    description: "For orgs that pair AI guides with code reviews.",
    cta: "Talk to sales",
    features: [
      "Workspace seats & SSO",
      "Insights dashboard",
      "Custom models / VPC",
      "Dedicated success partner",
    ],
  },
]
