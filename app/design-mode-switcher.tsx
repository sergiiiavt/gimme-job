"use client";

import { useEffect, useState } from "react";

type DesignMode = "old" | "new";

const STORAGE_KEY = "gimmejob-design";

function currentMode(): DesignMode {
  if (typeof document === "undefined") return "new";
  return document.documentElement.dataset.design === "old" ? "old" : "new";
}

export default function DesignModeSwitcher() {
  const [mode, setMode] = useState<DesignMode>("new");

  useEffect(() => {
    setMode(currentMode());
  }, []);

  const selectMode = (nextMode: DesignMode) => {
    document.documentElement.dataset.design = nextMode;
    setMode(nextMode);

    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Switching remains available even when persistent storage is blocked.
    }
  };

  return (
    <div aria-label="Site design" className="design-mode-switcher" role="group">
      <span>Design</span>
      <button aria-pressed={mode === "old"} data-design-option="old" onClick={() => selectMode("old")} type="button">Old</button>
      <button aria-pressed={mode === "new"} data-design-option="new" onClick={() => selectMode("new")} type="button">New</button>
    </div>
  );
}
