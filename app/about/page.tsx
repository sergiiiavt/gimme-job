"use client";

import AboutSiteEnhancements from "../about-site-enhancements";
import PublicSite from "../public-site";
import AboutSourceLinkFix from "./about-source-link-fix";

export default function AboutPage() {
  return (
    <>
      <PublicSite/>
      <AboutSiteEnhancements/>
      <AboutSourceLinkFix/>
    </>
  );
}
