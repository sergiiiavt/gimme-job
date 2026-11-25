# Projects, artifacts & skills

The second section of Claude 101 covers organizing your work and knowledge. Expect quiz questions about which feature fits which job.

## Projects

- A project is a self-contained workspace with its own chat history and knowledge base.
- **Project knowledge:** files you upload are used in every chat in that project.
- **Project instructions:** set tone or role for every chat in the project, for example "answer as a QA lead".
- Chats in a project do **not** share context with each other unless the information is in the project knowledge.
- Free accounts can create up to five projects. On paid plans, when project knowledge nears the context limit, Claude switches to retrieval (RAG) mode, which expands capacity up to ten times.
- On Team and Enterprise plans you can share a project. "Can use" members chat and view; "Can edit" members also change instructions and knowledge.

**Example:** a "Release 4.2" project holds the test plan, the release notes and your bug-report template, with the instruction "Flag any requirement that has no test." Every chat in it starts with that context.

## Artifacts

- An artifact is something Claude makes that you would put in front of someone: a document, a deck, a design, a dashboard or a small interactive tool.
- It opens beside the conversation. You can edit it, come back to it later and share it.
- Artifacts start private; nothing is shared until you share it.

**Example:** "Build a release-readiness dashboard from this test-run export" gives you a page you can keep updating and send to the team.

## Skills

- Skills are folders of instructions, scripts and resources that Claude loads when they are relevant to a task.
- They work by **progressive disclosure**: Claude checks which skills match the task and loads only what it needs, which keeps the context window from overflowing.
- **Anthropic skills** handle documents such as Excel, Word, PowerPoint and PDF files. **Custom skills** are ones you or your organization write, for example to apply brand guidelines, follow an email template or format meeting notes.
- Skills are available on Free, Pro, Max, Team and Enterprise plans, and need code execution turned on.
- The same skill format works in the Claude apps, Claude Code and the API.

**Example:** a "bug report" skill that always produces title, environment, steps, expected, actual and severity, so you stop re-explaining the format.

## Projects, skills or connectors?

| You need | Use | Why |
| --- | --- | --- |
| The same background documents in every chat about one topic | Project | Project knowledge is always loaded in that project |
| A procedure done the same way wherever you ask | Skill | Skills load on demand, everywhere |
| Claude to read from or act in another app | Connector | Connectors give access to external services and data |

Skills and connectors work together: a connector gives Claude access to a tool, and a skill teaches it how to use that tool well.

## Choose the smallest feature

Reusable bug-report steps belong in a skill; stable product references can live in project knowledge; an editable readiness table can be an artifact; retrieving a private ticket needs an authorized connector. A skill does not create service permissions. Check actual artifact access before sharing; membership in a project is not a universal rule for every derived object. Retrieval makes selected knowledge available without promising every file appears verbatim in every turn.
