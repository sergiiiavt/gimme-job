# Privacy, content exclusion & safeguards

10–15% of GH-300, and the domain candidates most often under-prepare.

## Content exclusion

- Available on **Copilot Business and Copilot Enterprise** only.
- Configured at repository, organization or enterprise level, using path patterns such as `secrets/**`.
- Changes can take a while to reach editors; reload the IDE to test a new rule.
- Excluded content can still influence suggestions **semantically** when the IDE supplies information such as types from an excluded file.

## Exclusion on agentic surfaces is a moving target

GitHub's documentation stated that Copilot CLI, the cloud agent and agent mode in IDE chat did not support content exclusion. On 2 September 2026 GitHub announced that the Copilot app and Copilot CLI now respect exclusion policies for Business and Enterprise. Expect the exam to reward the principle rather than a feature matrix: **content exclusion is not a security boundary**, so keep secrets out of any file an agent could reach.

## Suggestions matching public code

An organization or user setting controls the duplication filter:

- **Block:** suggestions that match public code are dropped.
- **Allow:** matches are shown, and **code referencing** displays the matching public code and its licence so the developer can decide.

The duplication filter does not apply to the cloud agent.

## Editor settings

Copilot can be enabled or disabled per language and per workspace in the editor. Use this for file types where suggestions are unwanted, alongside organization policy.

## Troubleshooting

| Symptom | First check |
| --- | --- |
| Excluded file still used as context | Plan is Business or Enterprise, pattern matches, IDE reloaded |
| No suggestions at all | Copilot enabled for the language and signed in, policy allows the feature |
| Suggestions blocked unexpectedly | Public-code filter set to Block, content exclusion on that path |

## Worked example

Legal worries about licence exposure. The direct control is blocking suggestions matching public code at organization level; where matches are allowed, code referencing shows the licence. Turning off Chat or excluding every repository does not address the risk.
