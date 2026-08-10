#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeJob } from "./analyst.js";
import {
  getPaths,
  initializeConfig,
  loadEnvironment,
  loadProfile,
  loadSources,
  type AppPaths,
} from "./config.js";
import { JobDatabase } from "./db.js";
import type { MarketReport } from "./domain.js";
import {
  assertAllowedRecipient,
  authorizeGmail,
  sendGmailMessage,
} from "./gmail.js";
import { buildMarketReport } from "./market.js";
import { buildSources } from "./sources/index.js";
import { collectAllSources } from "./sources/types.js";

const HELP = `
Job Search Agent — approval-first job discovery and application workflow

Commands:
  init                              Create config files and SQLite database
  doctor                            Check local configuration
  sync [--manual-only]              Collect and deduplicate jobs
  analyze [--limit 25]              Score jobs and create tailored resume drafts
  market                            Aggregate requirements and market signals
  run [--limit 25]                  Run sync, analyze, and market (never sends)
  jobs [--limit 50]                 List collected jobs
  show <job-id>                     Show a job, analysis, resume, and draft
  queue [--min-score 55]            List drafts awaiting approval
  set-recipient <draft-id> <email>  Set or correct a recipient
  approve <draft-id> [--recipient]  Explicitly approve one draft
  reject <draft-id>                 Reject a draft
  send <draft-id>                   Send only an already APPROVED Gmail draft
  export <job-id>                   Export the tailored resume and draft as text
  gmail-auth [--force]              Connect Gmail through OAuth in your browser

The agent never sends from sync, analyze, market, run, or approve.
`;

function flag(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

function numberFlag(args: string[], name: string, fallback: number): number {
  const raw = flag(args, name);
  if (raw === null) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function markdownMarket(report: MarketReport): string {
  const list = (items: Array<{ name: string; count: number }>) =>
    items.length ? items.map((item) => `- ${item.name}: ${item.count}`).join("\n") : "- No data yet";
  const comparison = report.trendComparison.previousGeneratedAt
    ? `Compared with ${report.trendComparison.previousGeneratedAt}: remote ${report.trendComparison.remoteShareDelta! >= 0 ? "+" : ""}${report.trendComparison.remoteShareDelta} pp; salary disclosure ${report.trendComparison.salaryDisclosureShareDelta! >= 0 ? "+" : ""}${report.trendComparison.salaryDisclosureShareDelta} pp.\n\n${report.trendComparison.requirementDeltas.length ? report.trendComparison.requirementDeltas.map((item) => `- ${item.name}: ${item.delta >= 0 ? "+" : ""}${item.delta}`).join("\n") : "- No requirement-count changes"}`
    : "Baseline created. Run again later to calculate changes.";
  return `# Job market snapshot\n\nGenerated: ${report.generatedAt}\n\n- Total jobs: ${report.totalJobs}\n- Analyzed jobs: ${report.analyzedJobs}\n- Remote share: ${report.remoteShare}%\n- Salary disclosed: ${report.salaryDisclosureShare}%\n- Mobilization reservation mentions: ${report.reservationMentions}\n\n## Top requirements\n${list(report.topRequirements)}\n\n## Most frequent candidate gaps\n${list(report.topCandidateGaps)}\n\n## Changes over time\n${comparison}\n\n## Top sources\n${list(report.topSources)}\n\n## Top roles\n${list(report.topRoles)}\n\n## Top locations\n${list(report.topLocations)}\n`;
}

async function syncJobs(
  db: JobDatabase,
  paths: AppPaths,
  args: string[],
): Promise<{ inserted: number; seen: number; errors: number }> {
  const config = loadSources(paths.sources);
  const sources = await buildSources(config, paths, process.cwd(), {
    manualOnly: args.includes("--manual-only"),
  });
  const results = await collectAllSources(sources);
  let inserted = 0;
  let seen = 0;
  let errors = 0;

  for (const result of results) {
    if (result.error) {
      errors += 1;
      console.error(`[${result.source}] ${result.error}`);
      continue;
    }
    for (const job of result.jobs) {
      seen += 1;
      if (db.upsertJob(job).inserted) inserted += 1;
    }
    console.log(`[${result.source}] ${result.jobs.length} jobs`);
  }
  console.log(`Sync complete: ${seen} seen, ${inserted} new, ${errors} source errors.`);
  return { inserted, seen, errors };
}

async function analyzeJobs(db: JobDatabase, paths: AppPaths, args: string[]): Promise<number> {
  const limit = numberFlag(args, "--limit", 25);
  const profile = loadProfile(paths.profile);
  const jobs = db.listJobsForAnalysis(limit);
  if (jobs.length === 0) {
    console.log("No unanalyzed jobs.");
    return 0;
  }

  let completed = 0;
  for (const job of jobs) {
    const { pkg, mode } = await analyzeJob(job, profile);
    db.savePackage(job.id, pkg, mode);
    completed += 1;
    console.log(`${job.id} | ${pkg.analysis.score} | ${pkg.analysis.verdict} | ${job.title}`);
  }
  console.log(`Analysis complete: ${completed} jobs (${process.env.OPENAI_API_KEY ? "agent" : "deterministic fallback"}).`);
  return completed;
}

function marketReport(db: JobDatabase, paths: AppPaths): MarketReport {
  const report = buildMarketReport(db.marketRows(), new Date(), db.latestMarketSnapshot());
  db.saveMarketSnapshot(report);
  writeFileSync(path.join(paths.exports, "market-latest.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(paths.exports, "market-latest.md"), markdownMarket(report));
  console.log(markdownMarket(report));
  return report;
}

function printJobs(db: JobDatabase, args: string[]): void {
  const limit = numberFlag(args, "--limit", 50);
  console.table(
    db.listJobs(limit).map((job) => ({
      id: job.id,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      status: job.status,
    })),
  );
}

function showJob(db: JobDatabase, jobId: string): void {
  const job = db.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  const analysis = db.getAnalysis(jobId);
  const resume = db.getResume(jobId);
  const draft = db.listDrafts(undefined, 500).find((item) => item.jobId === jobId) ?? null;
  console.log(JSON.stringify({ job, analysis, draft }, null, 2));
  if (resume) console.log(`\n--- TAILORED RESUME ---\n\n${resume}`);
}

function queue(db: JobDatabase, args: string[]): void {
  const minScore = numberFlag(args, "--min-score", 55);
  console.table(
    db.listQueue(minScore).map(({ draft, job, score, verdict }) => ({
      draftId: draft.id,
      score,
      verdict,
      status: draft.status,
      title: job.title,
      company: job.company,
      recipient: draft.recipient ?? "—",
      applyUrl: job.applyUrl,
    })),
  );
}

function exportJob(db: JobDatabase, paths: AppPaths, jobId: string): void {
  const job = db.getJob(jobId);
  const resume = db.getResume(jobId);
  const draft = db.listDrafts(undefined, 500).find((item) => item.jobId === jobId) ?? null;
  if (!job || !resume || !draft) throw new Error(`Analyzed job package not found: ${jobId}`);
  const resumePath = path.join(paths.exports, `${jobId}-resume.md`);
  const draftPath = path.join(paths.exports, `${jobId}-application.txt`);
  writeFileSync(resumePath, resume);
  writeFileSync(
    draftPath,
    `To: ${draft.recipient ?? "<set recipient>"}\nSubject: ${draft.subject}\n\n${draft.body}\n`,
  );
  console.log(`Exported:\n${resumePath}\n${draftPath}`);
}

async function main(): Promise<void> {
  loadEnvironment();
  const [command = "help", ...args] = process.argv.slice(2);

  if (command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }

  const paths = command === "init" ? initializeConfig() : getPaths();

  if (command === "gmail-auth") {
    await authorizeGmail(paths.googleCredentials, paths.googleToken, args.includes("--force"));
    console.log("Gmail OAuth connection saved locally.");
    return;
  }

  if (command === "doctor") {
    console.table([
      { item: "Profile", ready: existsSync(paths.profile), path: paths.profile },
      { item: "Sources", ready: existsSync(paths.sources), path: paths.sources },
      { item: "OpenAI key", ready: Boolean(process.env.OPENAI_API_KEY), path: "environment" },
      { item: "Google credentials", ready: existsSync(paths.googleCredentials), path: paths.googleCredentials },
      { item: "Google token", ready: existsSync(paths.googleToken), path: paths.googleToken },
    ]);
    return;
  }

  if (command !== "init" && (!existsSync(paths.profile) || !existsSync(paths.sources))) {
    throw new Error('Configuration is missing. Run "npm run init-db" first.');
  }

  const db = new JobDatabase(paths.db);
  try {
    switch (command) {
      case "init":
        console.log(`Initialized. Edit:\n${paths.profile}\n${paths.sources}`);
        break;
      case "sync":
        await syncJobs(db, paths, args);
        break;
      case "analyze":
        await analyzeJobs(db, paths, args);
        break;
      case "market":
        marketReport(db, paths);
        break;
      case "run":
        await syncJobs(db, paths, args);
        await analyzeJobs(db, paths, args);
        marketReport(db, paths);
        break;
      case "jobs":
        printJobs(db, args);
        break;
      case "show":
        if (!args[0]) throw new Error("Usage: show <job-id>");
        showJob(db, args[0]);
        break;
      case "queue":
        queue(db, args);
        break;
      case "set-recipient": {
        const [draftId, recipient] = args;
        if (!draftId || !recipient) throw new Error("Usage: set-recipient <draft-id> <email>");
        if (!db.setDraftRecipient(draftId, recipient)) throw new Error("Draft not found or already sent.");
        console.log(`Recipient updated for ${draftId}.`);
        break;
      }
      case "approve": {
        const draftId = args[0];
        if (!draftId) throw new Error("Usage: approve <draft-id> [--recipient email]");
        const recipient = flag(args, "--recipient");
        if (recipient && !db.setDraftRecipient(draftId, recipient)) {
          throw new Error("Draft not found or already sent.");
        }
        if (!db.approveDraft(draftId)) {
          throw new Error("Draft cannot be approved from its current state.");
        }
        console.log(`${draftId} approved. It has NOT been sent.`);
        break;
      }
      case "reject": {
        const draftId = args[0];
        if (!draftId) throw new Error("Usage: reject <draft-id>");
        if (!db.rejectDraft(draftId)) throw new Error("Draft cannot be rejected from its current state.");
        console.log(`${draftId} rejected.`);
        break;
      }
      case "send": {
        const draftId = args[0];
        if (!draftId) throw new Error("Usage: send <draft-id>");
        const draft = db.getDraft(draftId);
        if (!draft) throw new Error(`Draft not found: ${draftId}`);
        if (draft.status !== "APPROVED") {
          throw new Error(`Refusing to send: ${draftId} status is ${draft.status}, not APPROVED.`);
        }
        if (!draft.recipient) throw new Error("Draft has no recipient. Use set-recipient first.");
        const sourceConfig = loadSources(paths.sources);
        assertAllowedRecipient(draft.recipient, sourceConfig.gmail.allowedSendDomains);
        const auth = await authorizeGmail(paths.googleCredentials, paths.googleToken);
        const messageId = await sendGmailMessage(auth, {
          to: draft.recipient,
          subject: draft.subject,
          body: draft.body,
        });
        if (!db.markSent(draftId, messageId)) {
          throw new Error("Message was sent but the database state could not be updated.");
        }
        console.log(`${draftId} sent. Gmail message ID: ${messageId}`);
        break;
      }
      case "export":
        if (!args[0]) throw new Error("Usage: export <job-id>");
        exportJob(db, paths, args[0]);
        break;
      default:
        throw new Error(`Unknown command: ${command}\n${HELP}`);
    }
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
