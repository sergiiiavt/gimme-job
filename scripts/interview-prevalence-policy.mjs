const INTERVIEW_BANK_SOURCE_FAMILIES = new Map([
  ["dou-qa-2022", "dou"],
  ["dou-qa-400-2023", "dou"],
  ["katalon-qa-interviews", "katalon"],
  ["indeed-qa-interviews", "indeed"],
  ["gfg-testing-interviews", "gfg"],
  ["testsigma-qa-interviews-2026", "testsigma"],
  ["bugbug-qa-interviews-2026", "bugbug"],
  ["kore1-qa-interviews-2026", "kore1"],
  ["asserthired-qa-bank-2026", "asserthired"],
  ["asserthired-git-qa-2026", "asserthired"],
  ["asserthired-mobile-qa-2026", "asserthired"],
]);

const SPECIALIST_CATEGORIES = new Set([
  "Embedded and IoT",
  "AI, ML and LLM",
  "Regulated domains",
]);

const COMMON_BY_DEFAULT_CATEGORIES = new Set([
  "Fundamentals",
  "Test design",
  "Requirements and analysis",
  "Test documentation",
  "Defects and reporting",
  "SDLC, STLC and Agile",
  "Web and API",
  "Databases, SQL and BI",
  "Practical tasks",
]);

const VERY_COMMON_PATTERNS = [
  /\bwhat is (software )?testing\b/i,
  /\bwhy (do we |should we )?test\b/i,
  /\bqa\b.*\bqc\b|\bquality assurance\b.*\bquality control\b/i,
  /\bverification\b.*\bvalidation\b|\bvalidation\b.*\bverification\b/i,
  /\btest levels?\b/i,
  /\btypes? of testing\b|\btesting types?\b/i,
  /\btest[- ]design techniques?\b/i,
  /\bequivalence partition/i,
  /\bboundary value/i,
  /\bregression\b.*\b(retest|re-test|confirmation)\b|\b(retest|re-test|confirmation)\b.*\bregression\b/i,
  /\bsmoke\b.*\bsanity\b|\bsanity\b.*\bsmoke\b/i,
  /\bblack[- ]box\b.*\bwhite[- ]box\b|\bwhite[- ]box\b.*\bblack[- ]box\b/i,
  /\bseverity\b.*\bpriority\b|\bpriority\b.*\bseverity\b/i,
  /\bbug life cycle\b|\bdefect life cycle\b/i,
  /\bbug report\b.*\b(field|attribute|contain|good)\b/i,
  /\btest case\b.*\b(checklist|good|contain|write)\b/i,
  /\btest plan\b.*\b(what|contain|include|purpose)\b/i,
  /\bSTLC\b|\bsoftware testing life cycle\b/i,
  /\bfunctional\b.*\bnon[- ]functional\b|\bnon[- ]functional\b.*\bfunctional\b/i,
  /\bpositive\b.*\bnegative testing\b|\bnegative\b.*\bpositive testing\b/i,
  /\bstatic\b.*\bdynamic testing\b|\bdynamic\b.*\bstatic testing\b/i,
  /\bentry criteria\b.*\bexit criteria\b|\bexit criteria\b.*\bentry criteria\b/i,
  /\bAgile\b.*\btesting\b|\btesting\b.*\bAgile\b/i,
  /\bDefinition of Done\b/i,
];

const COMMON_PATTERNS = [
  /\bdecision table/i,
  /\bstate transition/i,
  /\bexploratory testing/i,
  /\brisk[- ]based testing/i,
  /\btraceability matrix\b|\brequirements traceability\b/i,
  /\bgood requirement/i,
  /\btest scenario/i,
  /\bacceptance criteria/i,
  /\broot cause analysis\b|\bRCA\b/i,
  /\bHTTP (method|status|request|response)/i,
  /\bREST\b.*\bAPI\b|\bAPI\b.*\bREST\b/i,
  /\bGET\b.*\bPOST\b|\bPOST\b.*\bGET\b/i,
  /\bstatus codes?\b/i,
  /\bSQL\b.*\bjoin\b|\bjoin\b.*\bSQL\b/i,
  /\bprimary key\b|\bforeign key\b/i,
  /\bnormalization\b/i,
  /\btransaction\b/i,
  /\bautomation framework\b/i,
  /\btest pyramid\b/i,
  /\bCI\/CD\b|\bcontinuous integration\b/i,
  /\bmock\b.*\bstub\b|\bstub\b.*\bmock\b/i,
  /\bflaky test/i,
  /\bpage object/i,
  /\bwhat (would|do) you test\b|\bhow would you test\b/i,
  /\bno (written )?requirements\b|\bwithout (written )?requirements\b/i,
  /\bwhen (is|would) testing (be )?(complete|finished|done)\b/i,
];

function matchesAny(question, patterns) {
  const text = `${question.question ?? ""} ${question.tags?.join(" ") ?? ""}`;
  return patterns.some((pattern) => pattern.test(text));
}

function interviewBankHitCount(question) {
  return new Set(
    (question.sourceIds ?? [])
      .map((sourceId) => INTERVIEW_BANK_SOURCE_FAMILIES.get(sourceId))
      .filter(Boolean),
  ).size;
}

export function reviewInterviewPrevalence(question) {
  if (SPECIALIST_CATEGORIES.has(question.category)) return "Specialist";

  if (question.id?.startsWith("expanded-")) {
    if (question.category === "Practical tasks") return "Common";
    return "Occasional";
  }

  const bankHits = interviewBankHitCount(question);
  if (bankHits >= 3) return "Very common";
  if (matchesAny(question, VERY_COMMON_PATTERNS)) return "Very common";
  if (bankHits >= 2) return "Common";
  if (matchesAny(question, COMMON_PATTERNS)) return "Common";
  if (COMMON_BY_DEFAULT_CATEGORIES.has(question.category)) return "Common";

  return "Occasional";
}

export const interviewPrevalenceReview = {
  reviewedAt: "2026-08-21",
  bands: ["Very common", "Common", "Occasional", "Specialist"],
  basis: "Exact question wording, recurrence across independent maintained interview-source families, breadth across QA roles, and role-specificity. Multiple pages from one publisher count once, so DOU 250+/400+ and AssertHired specialist pages cannot inflate prevalence by duplication. Generated scenario variants are never promoted to Very common automatically.",
};
