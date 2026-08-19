import fs from "node:fs";

function edit(path, transform) {
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}

edit("app/public-site.tsx", (source) => {
  source = source.replace(
    '  const personalHref = sectionNavigationHref(section, "personal");\n  const contentMode: SiteMode = (section === "interview" || section === "python-interview") ? mode : effectiveMode;\n\n  return (',
    '  const personalHref = sectionNavigationHref(section, "personal");\n\n  return (',
  );
  source = source.replace('          mode={contentMode}\n          onSelect={openSection}', '          mode={effectiveMode}\n          onSelect={openSection}');
  source = source.replace('            mode={contentMode}\n            onTopicChange={setSubsection}', '            mode={effectiveMode}\n            onTopicChange={setSubsection}');
  return source;
});

edit("tests/interview-catalog.test.mjs", (source) => source.replace(
  '  assert.match(uiSource, /const contentMode: SiteMode = \\(section === "interview" \\|\\| section === "python-interview"\\) \\? mode : effectiveMode;/);\n',
  '',
));

edit("sonar-project.properties", (source) => source.replace(
  'scripts/validate-interview-content.mjs,scripts/generate-interview-expansion.mjs,',
  'scripts/validate-interview-content.mjs,scripts/generate-interview-expansion.mjs,scripts/interview-prevalence-policy.mjs,',
));

console.log("Reverted the over-restrictive interview mode change and aligned Sonar coverage scope.");
