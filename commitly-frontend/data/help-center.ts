type HelpCard = {
  href: string
  title: string
  description: string
}

type FAQ = {
  question: string
  answer: string
}

export const helpCards: HelpCard[] = [
  {
    href: "/help-center/getting-started",
    title: "Getting started",
    description: "Bootstrap commitly locally, connect GitHub, and run your first repo.",
  },
  {
    href: "/help-center/faq",
    title: "FAQ",
    description: "Quick answers for account, timelines, and data retention.",
  },
  {
    href: "/policies",
    title: "Terms & policies",
    description: "Privacy, security, and acceptable use policies.",
  },
  {
    href: "/release-notes",
    title: "Release notes",
    description: "Highlights from the latest product drops.",
  },
]

export const onboardingSteps = [
  "Paste any GitHub repo URL from the home screen.",
  "Commitly fetches commits and builds a hands-on learning plan.",
  "Follow the timeline tasks, request hints, and share progress.",
]

export const faqs: FAQ[] = [
  {
    question: "What does commitly actually do?",
    answer:
      "It turns a GitHub repository into a guided learning path with concrete tasks, hints, and background reading so you understand decisions inside the codebase.",
  },
  {
    question: "Can I use private repositories?",
    answer:
      "Yes on the Pro plan and higher. OAuth scopes are limited to the repo you import, and you can revoke access any time.",
  },
  {
    question: "How does pricing work?",
    answer:
      "You only pay for the workspace plan you select. There are no usage-based surprises and you can export all of your data before downgrading.",
  },
  {
    question: "Where should I report bugs?",
    answer:
      "Open the account menu inside the app and select “Report bug”. Attach screenshots or logs so the team can reproduce issues quickly.",
  },
]
