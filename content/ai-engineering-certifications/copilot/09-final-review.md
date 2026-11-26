# Final review

## High-yield distinctions

| Pair | Remember |
| --- | --- |
| Ask vs edit vs agent mode | Answers; proposes edits; plans, edits, runs and iterates |
| Agent mode vs cloud agent | In your IDE with you; on GitHub from an issue, delivering a PR |
| `copilot-instructions.md` vs `*.instructions.md` | Whole repository; files matching `applyTo` |
| Instructions vs prompt files | Standing rules; reusable prompts you run |
| Block vs allow public-code matches | Dropped; shown with code referencing |
| Content exclusion vs security | Hygiene that limits context; not a security boundary |
| Policies vs audit log | Switch features on or off; record who changed what |
| Zero-shot vs few-shot | Instruction only; instruction plus examples |

## Distractor patterns

1. **Blunt instruments:** disabling Copilot org-wide or excluding everything to solve a narrow problem.
2. **Wrong file:** README, `.copilotignore` or `package.json` instead of the instruction and prompt files.
3. **Trusting the model:** asking Copilot to confirm its own suggestion instead of checking documentation.
4. **Skipping gates:** committing AI code because it compiles.
5. **Assuming instant effect:** expecting exclusion changes to apply immediately without a reload.
