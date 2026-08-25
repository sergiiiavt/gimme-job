"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { interviewPathFromPathname, readRememberedInterviewPath, rememberInterviewPath } from "./interview-navigation-memory";

function findInterviewNavLink() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>("a.kb-nav-link"))
    .find((link) => link.textContent?.trim() === "Interview questions") ?? null;
}

export default function InterviewNavigationState() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const currentInterviewPath = interviewPathFromPathname(pathname);
    if (currentInterviewPath) rememberInterviewPath(currentInterviewPath);
  }, [pathname]);

  useEffect(() => {
    const syncHref = () => {
      const rememberedPath = readRememberedInterviewPath();
      const link = findInterviewNavLink();
      if (!rememberedPath || !link) return;
      link.dataset.interviewReturnLink = "true";
      link.href = rememberedPath;
    };

    syncHref();
    const observer = new MutationObserver(syncHref);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a.kb-nav-link");
      if (!link || link.dataset.interviewReturnLink !== "true") return;

      const rememberedPath = readRememberedInterviewPath();
      if (!rememberedPath) return;

      event.preventDefault();
      event.stopPropagation();
      router.push(rememberedPath);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname, router]);

  return null;
}
