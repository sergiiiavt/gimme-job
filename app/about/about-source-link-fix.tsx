"use client";

import { useEffect } from "react";

const RAW_PREFIX = "https://raw.githubusercontent.com/sergiiiavt/gimme-job/main/";
const BLOB_PREFIX = "https://github.com/sergiiiavt/gimme-job/blob/main/";

function rewriteRawGithubLinks(root: ParentNode) {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>(`a[href^="${RAW_PREFIX}"]`)) {
    const path = anchor.href.slice(RAW_PREFIX.length);
    if (path) anchor.href = `${BLOB_PREFIX}${path}`;
  }
}

export default function AboutSourceLinkFix() {
  useEffect(() => {
    rewriteRawGithubLinks(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target instanceof HTMLAnchorElement && target.href.startsWith(RAW_PREFIX)) {
            const path = target.href.slice(RAW_PREFIX.length);
            if (path) target.href = `${BLOB_PREFIX}${path}`;
          }
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (node instanceof Element) rewriteRawGithubLinks(node);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["href"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
