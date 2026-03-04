import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const translationsPath = new URL("../lib/i18n/translations.ts", import.meta.url);
const translationsSource = readFileSync(translationsPath, "utf8");

const enBlock = translationsSource.match(/const en = \{([\s\S]*?)\n\} as const;/);
if (!enBlock) {
  console.error("[i18n] Unable to parse `en` dictionary.");
  process.exit(1);
}

const enKeys = new Set();
const enKeyRegex = /\n\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
let keyMatch;
while ((keyMatch = enKeyRegex.exec(enBlock[1]))) {
  enKeys.add(keyMatch[1]);
}

let usageLines = [];
try {
  usageLines = execSync(
    "rg -n --no-heading 't\\(\"[^\"]+\"' app components lib --glob '!lib/i18n/translations.ts'",
    { cwd: new URL("..", import.meta.url).pathname }
  )
    .toString()
    .split("\n")
    .filter(Boolean);
} catch {
  usageLines = [];
}

const usedKeys = new Set();
for (const line of usageLines) {
  const match = line.match(/\bt\("([^"]+)"/);
  if (!match) continue;
  const key = match[1];
  if (/^[a-z][a-z0-9_-]*$/.test(key)) {
    usedKeys.add(key);
  }
}

const missingInEn = [...usedKeys].filter((key) => !enKeys.has(key)).sort();
if (missingInEn.length > 0) {
  console.error("[i18n] Missing keys in English dictionary:");
  for (const key of missingInEn) {
    console.error(` - ${key}`);
  }
  process.exit(1);
}

const localeBlocks = [...translationsSource.matchAll(/const (\w+)Overrides:[\s\S]*?= \{([\s\S]*?)\n\};/g)];
const localeMissing = [];
for (const [, localeName, block] of localeBlocks) {
  const overrideKeys = new Set();
  const overrideRegex = /\n\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
  let match;
  while ((match = overrideRegex.exec(block))) {
    overrideKeys.add(match[1]);
  }
  // Locales are allowed to inherit from English fallback, but we still require core route keys.
  const requiredCoreKeys = [
    "new_repo_roadmap",
    "search_roadmaps",
    "timeline",
    "guide",
    "settings_preferences",
    "help_title",
    "policies_title",
    "release_notes_title",
    "plans_title",
  ];
  const missingCore = requiredCoreKeys.filter((key) => !overrideKeys.has(key));
  if (missingCore.length > 0) {
    localeMissing.push({ localeName, missingCore });
  }
}

if (localeMissing.length > 0) {
  console.error("[i18n] Missing required core locale overrides:");
  for (const issue of localeMissing) {
    console.error(` - ${issue.localeName}: ${issue.missingCore.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[i18n] OK. Used keys: ${usedKeys.size}, English keys: ${enKeys.size}.`);
