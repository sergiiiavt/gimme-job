"use client";

import { createElement, useEffect, useState } from "react";

export type AuthViewMode = "public" | "personal";
type AuthProbeResponse = { ok: boolean };
type AuthProbe = () => Promise<AuthProbeResponse>;
type AuthSyncOptions = {
  mode: AuthViewMode;
  personalHref: string;
  onAuthenticatedChange: (authenticated: boolean) => void;
  probe?: AuthProbe;
  currentHref?: () => string;
  replace?: (href: string) => void;
};

export type AuthSessionResponse = {
  enabled: boolean;
  authenticated: boolean;
  user?: { id: string; email: string; name: string | null; pictureUrl: string | null };
  gmail?: { connected: boolean; email?: string };
};

export type ForwardingSetup = {
  address: string | null;
  verificationUrl: string | null;
  confirmationCode: string | null;
};

type SessionFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const FORWARDING_POLL_MS = 5000;
const actionStyle = {
  background: "transparent", border: 0, borderRadius: "5px", color: "#526059", cursor: "pointer",
  display: "block", fontSize: "12px", fontWeight: 700, padding: "8px 6px", textAlign: "left", width: "100%",
} as const;
const verificationStyle = {
  ...actionStyle, color: "#315a43", textDecoration: "none",
} as const;
const summaryStyle = {
  alignItems: "center", borderRadius: "7px", cursor: "pointer", display: "grid", gap: "9px",
  gridTemplateColumns: "32px minmax(0, 1fr)", listStyle: "none", padding: "7px 6px",
} as const;
const avatarStyle = {
  alignItems: "center", background: "#e8eee8", border: "1px solid #d6ded7", borderRadius: "50%", color: "#315542",
  display: "flex", fontSize: "12px", fontWeight: 850, height: "32px", justifyContent: "center", width: "32px",
} as const;
const primaryStyle = { color: "#28342e", display: "block", fontSize: "11px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const secondaryStyle = { color: "#7a8580", display: "block", fontSize: "9px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const menuStyle = { borderTop: "1px solid #e1e5e1", marginTop: "5px", paddingTop: "6px" } as const;
const forwardingStyle = { color: "#657069", display: "block", fontSize: "10px", lineHeight: 1.45, padding: "6px", overflowWrap: "anywhere" } as const;

export function signInHref(personalHref: string): string {
  return `/workspace/login?next=${encodeURIComponent(personalHref)}`;
}

// Kept as helpers for the optional experimental Gmail OAuth path.
export function gmailConnectHref(personalHref: string): string {
  return `/auth/google/start?mode=gmail&next=${encodeURIComponent(personalHref)}`;
}
export function gmailDisconnectHref(personalHref: string): string {
  return `/auth/gmail/disconnect?next=${encodeURIComponent(personalHref)}`;
}

export function accountInitial(session: AuthSessionResponse | null): string {
  const value = session?.user?.name?.trim() || session?.user?.email?.trim() || "G";
  return value.slice(0, 1).toUpperCase();
}

export async function loadAuthSession(fetcher: SessionFetcher = fetch): Promise<AuthSessionResponse | null> {
  const response = await fetcher("/auth/session", { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSessionResponse>;
}

export async function loadForwardingSetup(fetcher: SessionFetcher = fetch): Promise<ForwardingSetup | null> {
  const response = await fetcher("/auth/forwarding", { cache: "no-store", headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const payload = await response.json() as { address?: string; verificationUrl?: string | null; confirmationCode?: string | null };
  return {
    address: payload.address?.trim() || null,
    verificationUrl: payload.verificationUrl?.trim() || null,
    confirmationCode: payload.confirmationCode?.trim() || null,
  };
}

export async function loadForwardingAddress(fetcher: SessionFetcher = fetch): Promise<string | null> {
  return (await loadForwardingSetup(fetcher))?.address ?? null;
}

export function shouldPollForwardingVerification(setup: ForwardingSetup | null): boolean {
  return Boolean(setup?.address && !setup.verificationUrl && !setup.confirmationCode);
}

export function shouldNormalizeToPersonal(mode: AuthViewMode, authenticated: boolean, personalHref: string, currentHref: string): boolean {
  if (!authenticated || mode !== "public") return false;
  const target = new URL(personalHref, "https://gimmejob.invalid");
  const current = new URL(currentHref, "https://gimmejob.invalid");
  return `${target.pathname}${target.search}` !== `${current.pathname}${current.search}`;
}

export function startAuthSync({
  mode, personalHref, onAuthenticatedChange,
  probe = async () => fetch("/api/auth-state", { cache: "no-store", headers: { accept: "application/json" } }),
  currentHref = () => window.location.href,
  replace = (href) => window.location.replace(href),
}: AuthSyncOptions): () => void {
  let active = true;
  void probe().then((response) => {
    if (!active) return;
    const authenticated = response.ok;
    onAuthenticatedChange(authenticated);
    if (shouldNormalizeToPersonal(mode, authenticated, personalHref, currentHref())) return replace(personalHref);
    if (!authenticated && mode === "personal") replace(signInHref(personalHref));
  }).catch(() => { if (active) onAuthenticatedChange(mode === "personal"); });
  return () => { active = false; };
}

function AnonymousControl({ personalHref }: { personalHref: string }) {
  return createElement("div", { className: "kb-auth-control" },
    createElement("div", { className: "kb-storage-state", "aria-live": "polite" },
      createElement("i", { "aria-hidden": "true" }),
      createElement("div", null, createElement("strong", null, "Public view"), createElement("span", null, "Sign in for personal tools")),
    ),
    createElement("a", { href: signInHref(personalHref) }, "Sign in"),
  );
}

function AuthenticatedControl({ session, forwarding }: { session: AuthSessionResponse | null; forwarding: ForwardingSetup | null }) {
  const name = session?.user?.name?.trim() || "Signed in";
  const email = session?.user?.email?.trim() || "Personal workspace";
  const copyAddress = () => { if (forwarding?.address && navigator.clipboard) void navigator.clipboard.writeText(forwarding.address); };
  const copyCode = () => { if (forwarding?.confirmationCode && navigator.clipboard) void navigator.clipboard.writeText(forwarding.confirmationCode); };

  return createElement("details", { className: "kb-auth-control" },
    createElement("summary", { style: summaryStyle, "aria-label": `Account: ${email}` },
      createElement("span", { style: avatarStyle, "aria-hidden": "true" }, accountInitial(session)),
      createElement("span", { style: { minWidth: 0 } },
        createElement("strong", { style: primaryStyle }, name),
        createElement("span", { style: secondaryStyle }, email),
      ),
    ),
    createElement("div", { style: menuStyle },
      createElement("span", { style: forwardingStyle },
        forwarding?.address ? `Forward job emails to ${forwarding.address}` : "Preparing your forwarding address…",
      ),
      forwarding?.address ? createElement("button", { type: "button", style: actionStyle, onClick: copyAddress }, "Copy forwarding address") : null,
      forwarding?.verificationUrl ? createElement("a", {
        href: forwarding.verificationUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        style: verificationStyle,
      }, "Verify Gmail forwarding") : null,
      !forwarding?.verificationUrl && forwarding?.confirmationCode ? createElement("button", {
        type: "button", style: verificationStyle, onClick: copyCode,
      }, `Copy Gmail confirmation code: ${forwarding.confirmationCode}`) : null,
      createElement("form", { action: "/workspace/logout", method: "post" },
        createElement("button", { style: actionStyle, type: "submit" }, "Log out"),
      ),
    ),
  );
}

export default function AuthStatusControl({ mode, personalHref }: { mode: AuthViewMode; personalHref: string }) {
  const [authenticated, setAuthenticated] = useState(mode === "personal");
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [forwarding, setForwarding] = useState<ForwardingSetup | null>(null);

  useEffect(() => startAuthSync({
    mode, personalHref,
    onAuthenticatedChange: (next) => { setAuthenticated(next); if (!next) { setSession(null); setForwarding(null); } },
  }), [mode, personalHref]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      try {
        const [nextSession, setup] = await Promise.all([loadAuthSession(), loadForwardingSetup()]);
        if (!active) return;
        if (nextSession) setSession(nextSession);
        setForwarding(setup);
        if (shouldPollForwardingVerification(setup)) {
          timer = setTimeout(() => { void refresh(); }, FORWARDING_POLL_MS);
        }
      } catch {
        if (active) timer = setTimeout(() => { void refresh(); }, FORWARDING_POLL_MS);
      }
    };

    void refresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [authenticated]);

  return authenticated
    ? createElement(AuthenticatedControl, { session, forwarding })
    : createElement(AnonymousControl, { personalHref });
}
