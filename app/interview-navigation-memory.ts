import { INTERVIEW_DOMAIN_ROUTES } from "@/content/interview/domain-routes";

export const LAST_INTERVIEW_PATH_KEY = "gimmejob:last-interview-path";

const genericInterviewPath = INTERVIEW_DOMAIN_ROUTES.find((route) => route.id === "generic-qa")?.path ?? "/interview/generic-qa";
const supportedInterviewPaths = new Set<string>([
  genericInterviewPath,
  "/interview/python",
  ...INTERVIEW_DOMAIN_ROUTES.map((route) => route.path),
]);

export function interviewPathFromPathname(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/interview") return genericInterviewPath;
  return supportedInterviewPaths.has(normalized) ? normalized : null;
}

export function rememberInterviewPath(pathname: string) {
  if (typeof window === "undefined") return;
  const path = interviewPathFromPathname(pathname);
  if (path) window.localStorage.setItem(LAST_INTERVIEW_PATH_KEY, path);
}

export function readRememberedInterviewPath() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LAST_INTERVIEW_PATH_KEY);
  return stored && supportedInterviewPaths.has(stored) ? stored : null;
}
