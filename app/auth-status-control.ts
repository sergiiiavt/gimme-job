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

const controlStyle = {
  display: "inline-block",
  position: "relative",
} as const;
const triggerStyle = {
  alignItems: "center",
  background: "#ffffff",
  border: "1px solid #dce2dd",
  borderRadius: "50%",
  boxShadow: "0 8px 24px rgba(28,39,35,.10)",
  cursor: "pointer",
  display: "flex",
  height: "42px",
  justifyContent: "center",
  listStyle: "none",
  padding: "3px",
  width: "42px",
} as const;
const avatarStyle = {
  alignItems: "center",
  background: "#e8eee8",
  border: "1px solid #d6ded7",
  borderRadius: "50%",
  color: "#315542",
  display: "flex",
  fontSize: "12px",
  fontWeight: 850,
  height: "34px",
  justifyContent: "center",
  overflow: "hidden",
  width: "34px",
} as const;
const avatarImageStyle = {
  height: "100%",
  objectFit: "cover",
  width: "100%",
} as const;
const menuStyle = {
  background: "#ffffff",
  border: "1px solid #dce2dd",
  borderRadius: "13px",
  boxShadow: "0 18px 48px rgba(28,39,35,.16)",
  color: "#28342e",
  maxHeight: "calc(100vh - 82px)",
  overflowY: "auto",
  padding: "16px",
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  width: "min(380px, calc(100vw - 24px))",
  zIndex: 100,
} as const;
const identityStyle = {
  alignItems: "center",
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "38px minmax(0, 1fr)",
} as const;
const menuAvatarStyle = {
  ...avatarStyle,
  height: "38px",
  width: "38px",
} as const;
const primaryStyle = {
  color: "#28342e",
  display: "block",
  fontSize: "13px",
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;
const secondaryStyle = {
  color: "#7a8580",
  display: "block",
  fontSize: "10px",
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;
const statusRowStyle = {
  alignItems: "center",
  display: "flex",
  gap: "7px",
  marginTop: "12px",
} as const;
const statusDotStyle = {
  background: "#30a873",
  borderRadius: "50%",
  height: "7px",
  width: "7px",
} as const;
const sectionStyle = {
  borderTop: "1px solid #e6e9e6",
  marginTop: "14px",
  paddingTop: "14px",
} as const;
const sectionTitleStyle = {
  color: "#34443b",
  display: "block",
  fontSize: "11px",
  fontWeight: 850,
  marginBottom: "8px",
} as const;
const mutedStyle = {
  color: "#69746e",
  fontSize: "10px",
  lineHeight: 1.5,
  margin: 0,
} as const;
const addressRowStyle = {
  alignItems: "center",
  background: "#f5f7f4",
  border: "1px solid #e1e6e1",
  borderRadius: "8px",
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  marginTop: "9px",
  padding: "8px",
} as const;
const addressStyle = {
  color: "#435149",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "9px",
  overflowWrap: "anywhere",
} as const;
const buttonStyle = {
  background: "#ffffff",
  border: "1px solid #d8dfd9",
  borderRadius: "7px",
  color: "#405048",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: 800,
  minHeight: "31px",
  padding: "0 10px",
} as const;
const primaryButtonStyle = {
  ...buttonStyle,
  alignItems: "center",
  background: "#315a43",
  borderColor: "#315a43",
  color: "#ffffff",
  display: "flex",
  justifyContent: "center",
  marginTop: "9px",
  textDecoration: "none",
  width: "100%",
} as const;
const instructionStyle = {
  color: "#647169",
  fontSize: "10px",
  lineHeight: 1.5,
  margin: "9px 0 0",
  paddingLeft: "19px",
} as const;
const instructionItemStyle = {
  marginTop: "6px",
  paddingLeft: "2px",
} as const;
const footerStyle = {
  borderTop: "1px solid #e6e9e6",
  marginTop: "14px",
  paddingTop: "10px",
} as const;
const logoutStyle = {
  background: "transparent",
  border: 0,
  borderRadius: "6px",
  color: "#8b3f46",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: 800,
  padding: "8px 6px",
  textAlign: "left",
  width: "100%",
} as const;
const anonymousStyle = {
  background: "#ffffff",
  border: "1px solid #dce2dd",
  borderRadius: "8px",
  boxShadow: "0 8px 24px rgba(28,39,35,.08)",
  color: "#315a43",
  display: "inline-flex",
  fontSize: "11px",
  fontWeight: 800,
  padding: "9px 12px",
} as const;

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

function AccountAvatar({ session, menu = false }: { session: AuthSessionResponse | null; menu?: boolean }) {
  const pictureUrl = session?.user?.pictureUrl?.trim();
  return createElement("span", { style: menu ? menuAvatarStyle : avatarStyle, "aria-hidden": "true" },
    pictureUrl
      ? createElement("img", { alt: "", src: pictureUrl, style: avatarImageStyle })
      : accountInitial(session),
  );
}

function AnonymousControl({ personalHref }: { personalHref: string }) {
  return createElement("a", {
    className: "kb-auth-control",
    href: signInHref(personalHref),
    style: anonymousStyle,
  }, "Sign in");
}

function AuthenticatedControl({
  session,
  forwarding,
  refreshing,
  onRefresh,
}: {
  session: AuthSessionResponse | null;
  forwarding: ForwardingSetup | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState<"address" | "code" | null>(null);
  const name = session?.user?.name?.trim() || "Signed in";
  const email = session?.user?.email?.trim() || "Personal workspace";
  const verificationReady = Boolean(forwarding?.verificationUrl || forwarding?.confirmationCode);
  const verificationState = verificationReady ? "Verification link received" : "Waiting for Gmail confirmation";

  const copy = (value: string, kind: "address" | "code") => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1500);
    });
  };

  return createElement("details", { className: "kb-auth-control", style: controlStyle },
    createElement("summary", { style: triggerStyle, "aria-label": `Account: ${email}` },
      createElement(AccountAvatar, { session }),
    ),
    createElement("div", { style: menuStyle, role: "group", "aria-label": "Account menu" },
      createElement("div", { style: identityStyle },
        createElement(AccountAvatar, { session, menu: true }),
        createElement("div", { style: { minWidth: 0 } },
          createElement("strong", { style: primaryStyle }, name),
          createElement("span", { style: secondaryStyle }, email),
        ),
      ),
      createElement("div", { style: statusRowStyle },
        createElement("i", { style: statusDotStyle, "aria-hidden": "true" }),
        createElement("span", { style: { ...mutedStyle, fontWeight: 750 } }, "Private account · Account registered"),
      ),
      createElement("section", { style: sectionStyle, "aria-label": "Gmail forwarding verification" },
        createElement("strong", { style: sectionTitleStyle }, "Gmail forwarding"),
        createElement("p", { style: mutedStyle }, verificationState),
        forwarding?.address
          ? createElement("div", { style: addressRowStyle },
              createElement("span", { style: addressStyle }, forwarding.address),
              createElement("button", {
                type: "button",
                style: buttonStyle,
                onClick: () => copy(forwarding.address as string, "address"),
              }, copied === "address" ? "Copied" : "Copy"),
            )
          : createElement("p", { style: { ...mutedStyle, marginTop: "8px" } }, "Preparing your forwarding address…"),
        createElement("ol", { style: instructionStyle },
          createElement("li", { style: instructionItemStyle }, "Copy the GimmeJob forwarding address above."),
          createElement("li", { style: instructionItemStyle }, "In Gmail, open Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address, then paste it."),
          createElement("li", { style: instructionItemStyle }, "Gmail sends a confirmation email to that address. Return here and check for the verification email."),
          createElement("li", { style: instructionItemStyle }, verificationReady
            ? "Open the verification link below to confirm forwarding in Gmail."
            : "When the confirmation arrives, the verification link or confirmation code will appear here."),
        ),
        forwarding?.verificationUrl
          ? createElement("a", {
              href: forwarding.verificationUrl,
              target: "_blank",
              rel: "noopener noreferrer",
              style: primaryButtonStyle,
            }, "Open Gmail verification link")
          : null,
        !forwarding?.verificationUrl && forwarding?.confirmationCode
          ? createElement("div", { style: addressRowStyle },
              createElement("span", { style: addressStyle }, `Confirmation code: ${forwarding.confirmationCode}`),
              createElement("button", {
                type: "button",
                style: buttonStyle,
                onClick: () => copy(forwarding.confirmationCode as string, "code"),
              }, copied === "code" ? "Copied" : "Copy"),
            )
          : null,
        createElement("button", {
          type: "button",
          style: { ...buttonStyle, marginTop: "9px", width: "100%" },
          disabled: refreshing,
          onClick: onRefresh,
        }, refreshing ? "Checking…" : "Check for verification email"),
      ),
      createElement("div", { style: footerStyle },
        createElement("form", { action: "/workspace/logout", method: "post" },
          createElement("button", { style: logoutStyle, type: "submit" }, "Sign out"),
        ),
      ),
    ),
  );
}

export default function AuthStatusControl({ mode, personalHref }: { mode: AuthViewMode; personalHref: string }) {
  const [authenticated, setAuthenticated] = useState(mode === "personal");
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [forwarding, setForwarding] = useState<ForwardingSetup | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => startAuthSync({
    mode, personalHref,
    onAuthenticatedChange: (next) => {
      setAuthenticated(next);
      if (!next) {
        setSession(null);
        setForwarding(null);
      }
    },
  }), [mode, personalHref]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    void Promise.all([loadAuthSession(), loadForwardingSetup()]).then(([nextSession, setup]) => {
      if (!active) return;
      if (nextSession) setSession(nextSession);
      setForwarding(setup);
    }).catch(() => {});
    return () => { active = false; };
  }, [authenticated]);

  const refreshForwarding = () => {
    setRefreshing(true);
    void loadForwardingSetup()
      .then((setup) => setForwarding(setup))
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  return authenticated
    ? createElement(AuthenticatedControl, { session, forwarding, refreshing, onRefresh: refreshForwarding })
    : createElement(AnonymousControl, { personalHref });
}
