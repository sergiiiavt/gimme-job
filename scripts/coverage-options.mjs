export function testCoverageArguments(lcovPath) {
  return [
    "--enable-source-maps",
    "--test",
    "--experimental-test-coverage",
    // Worker artifact tests still execute. Do not collect their minified copies:
    // remapping them onto the same TS files can overwrite source-test hits.
    // Application sources remain in Sonar's coverage denominator.
    "--test-coverage-exclude=dist/**",
    "--test-reporter=spec",
    "--test-reporter=lcov",
    "--test-reporter-destination=stdout",
    `--test-reporter-destination=${lcovPath}`,
  ];
}
