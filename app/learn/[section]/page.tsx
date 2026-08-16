"use client";

import { usePathname } from "next/navigation";
import PublicSite from "../../public-site";

export default function PublicLearningSectionPage() {
  const pathname = usePathname();
  return <PublicSite key={pathname}/>;
}
