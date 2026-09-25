"use client";

import { useEffect, useRef } from "react";

type DesignMode = "old" | "new";

const STORAGE_KEY = "gimmejob-design";

function currentMode(): DesignMode {
  return document.documentElement.dataset.design === "old" ? "old" : "new";
}

export default function DesignModeSwitcher() {
  const oldButtonRef = useRef<HTMLButtonElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);

  const syncPressedState = () => {
    const mode = currentMode();
    oldButtonRef.current?.setAttribute("aria-pressed", String(mode === "old"));
    newButtonRef.current?.setAttribute("aria-pressed", String(mode === "new"));
  };

  useEffect(() => {
    syncPressedState();
  }, []);

  const selectMode = (nextMode: DesignMode) => {
    document.documentElement.dataset.design = nextMode;

    try {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Switching remains available even when persistent storage is blocked.
    }

    syncPressedState();
  };

  return (
    <div aria-label="Site design" className="design-mode-switcher" role="group">
      <span>Design</span>
      <button aria-pressed="false" data-design-option="old" onClick={() => selectMode("old")} ref={oldButtonRef} type="button">Old</button>
      <button aria-pressed="true" data-design-option="new" onClick={() => selectMode("new")} ref={newButtonRef} type="button">New</button>
    </div>
  );
}
