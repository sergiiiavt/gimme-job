export type NavigationMode = "public" | "personal";

const dedicatedSectionPaths: Record<string, { public: string; personal: string }> = {
  about: { public: "/learn#about", personal: "/learn#about" },
  programming: { public: "/learn/programming", personal: "/workspace/learn/programming" },
  automation: { public: "/learn/automation", personal: "/workspace/learn/automation" },
  devops: { public: "/learn/cloud-devops", personal: "/workspace/learn/cloud-devops" },
};

export function sectionNavigationHref(section: string, mode: NavigationMode): string {
  const dedicated = dedicatedSectionPaths[section];
  if (dedicated) return dedicated[mode];
  if (section === "jobs") return "/workspace";
  return mode === "public" ? `/learn#${section}` : `/workspace/learn?section=${section}`;
}
