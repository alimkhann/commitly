type PolicyLink = {
  href: string;
  label: string;
  summary: string;
};

export const policyLinks: PolicyLink[] = [
  {
    href: "/policies/terms-of-use",
    label: "Terms of use",
    summary: "Rules for accessing commitly products and developer APIs.",
  },
  {
    href: "/policies/privacy-policy",
    label: "Privacy policy",
    summary: "What personal data we collect and how we handle requests.",
  },
  {
    href: "/policies/data-use",
    label: "Data use",
    summary: "How repository content is processed, cached, and deleted.",
  },
  {
    href: "/policies/security",
    label: "Security",
    summary: "Controls we use to safeguard infrastructure and customer data.",
  },
];

export const policyMeta = {
  updated: "2024-09-30",
  contact: "security@commitly.dev",
};
