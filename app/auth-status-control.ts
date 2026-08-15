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

const actionStyle = {
  background: "transparent",
  border: 0,
  borderRadius: "5px",
  color: "#526059",
  cursor: "pointer",
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  padding: "8px 6px",
  textAlign: "left",
  width: "100%",
} as const;

export function signInHref(personalHref: string): string {
  return `/workspace/login?next=${encodeURIComponent(personalHref)}`;
}

export function shouldNormalizeToPersonal(mode: AuthViewMode, authenticated: boolean, personalHref: string, currentHref: string): boolean {
  if (!authenticated || mode !== "public") return false;
  const target = new URL(personalHref, "https://gimmejob.invalid");
  const current = new URL(currentHref, "https://gimmejob.invalid");
  return `${target.pathname}${target.search}` !== `${current.pathname}${current.search}`;
}

export function startAuthSync({
  mode,
  personalHref,
  onAuthenticatedChange,
  probe = async () => fetch("/api/auth-state", { cache: "no-store", headers: { accept: "application/json" } }),
  currentHref = () => window.location.href,
  replace = (href) => window.location.replace(href),
}: AuthSyncOptions): () => void {
  let active = true;

  void probe()
    .then((response) => {
      if (!active) return;
      const authenticated = response.ok;
      onAuthenticatedChange(authenticated);

      if (shouldNormalizeToPersonal(mode, authenticated, personalHref, currentHref())) {
        replace(personalHref);
        return;
      }

      if (!authenticated && mode === "personal") {
        replace(signInHref(personalHref));
      }
    })
    .catch(() => {
      if (active) onAuthenticatedChange(mode === "personal");
    });

  return () => {
    active = false;
  };
}

export default function AuthStatusControl({ mode, personalHref }: { mode: AuthViewMode; personalHref: string }) {
  const [authenticated, setAuthenticated] = useState(mode === "personal");

  useEffect(() => startAuthSync({
    mode,
    personalHref,
    onAuthenticatedChange: setAuthenticated,
  }), [mode, personalHref]);

  const status = createElement(
    "div",
    { className: "kb-storage-state", "aria-live": "polite" },
    createElement("i", { className: authenticated ? "online" : undefined, "aria-hidden": "true" }),
    createElement(
      "div",
      null,
      createElement("strong", null, authenticated ? "Signed in" : "Public view"),
      createElement("span", null, authenticated ? "Personal tools enabled" : "Personal tools are locked"),
    ),
  );

  const action = authenticated
    ? createElement(
      "form",
      { action: "/workspace/logout", method: "post" },
      createElement("button", { style: actionStyle, type: "submit" }, "Log out"),
    )
    : createElement("a", { href: signInHref(personalHref) }, "Sign in");

  return createElement("div", { className: "kb-auth-control" }, status, action);
}
