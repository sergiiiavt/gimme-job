# Test tools

Chapter 6 is short: tool categories, and the benefits and risks of test automation.

## Tool support for testing

- **Management tools:** SDLC, requirements, tests and defects; configuration management.
- **Static testing tools:** reviews and static analysis.
- **Test design and implementation tools:** generate test cases, data and procedures.
- **Test execution and coverage tools:** automated execution and coverage measurement.
- **Non-functional testing tools:** for example performance and security testing.
- **DevOps tools:** the delivery pipeline, workflow tracking, automated builds, CI/CD.
- **Collaboration tools:** communication.
- **Tools for scalability and deployment standardisation:** virtual machines and containers.

## Benefits of test automation

- Time saved on repetitive manual work such as regression testing.
- Fewer simple human errors through consistency and repeatability.
- More objective assessment, such as coverage, and measures too complex for humans.
- Easier access to information for management and reporting.
- Shorter test execution times, earlier defect detection and faster time to market.
- More time for testers to design new, deeper and more effective tests.

## Risks of test automation

- Unrealistic expectations about benefits.
- Inaccurate estimates of time, cost and effort to introduce, maintain and train.
- Using a tool where manual testing is more appropriate.
- Relying on a tool too much, ignoring the need for human critical thinking.
- Dependency on the vendor, which may go out of business, retire the tool or give poor support.
- An open-source project being abandoned.
- Incompatibility with the development platform.
- A tool that does not meet regulatory or safety requirements.

## Worked example

A team buys a record-and-playback tool expecting to automate every manual test within a month. Two risks apply: unrealistic expectations, and inaccurate estimation of the effort to build and maintain the suite. A pilot on a small, stable regression set would reduce both.

## Automation investment calculation

Assume 20 manual runs at 8 hours each: 160 hours. Automation setup 40 hours, maintenance 20 and execution/review 0.5 hours per run: 70 hours, a 90-hour saving over these runs. For two runs the same fixed investment costs 61 hours versus 16 manual. Document assumptions, environment effort and flakiness; a tool is not automatically economical or a replacement for human analysis.
