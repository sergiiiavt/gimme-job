# Using Claude well

The first section of Claude 101: what Claude is, how a conversation works, and how to ask for what you want.

## What Claude is

Claude is Anthropic's AI model and the assistant built on it. You use it on the web, in the desktop app and in the mobile apps. Developers also reach it through Claude Code for software work and through the Claude API for their own products.

A chat starts from your message plus whatever context you bring in: attached files, project knowledge, instructions and memory. Memory is on by default for Free, Pro and Max plans; on Team and Enterprise plans an owner turns it on.

## Getting better results

The habits the course teaches match Anthropic's prompting guidance:

- **Say what you want and why.** Give the goal, the audience and the constraints.
- **Give the context Claude cannot guess.** Attach or paste the source material instead of describing it.
- **Show an example** of the output you want.
- **Ask for a format**: a table, five bullets, a checklist, a length limit.
- **Break big jobs into steps** and check each result before the next.
- **Iterate.** Tell Claude what to change instead of starting a new chat.
- **Invite questions**: "Ask me anything unclear before you start."

| Weak prompt | Strong prompt |
| --- | --- |
| Write test cases for login. | Write 10 test cases for the login form in the attached spec. Cover lockout after 5 failed attempts and password reset. Return a table with ID, steps, expected result and priority. |
| Summarise this bug list. | Group the attached 60 bugs by component, flag the 5 most severe for a release decision, and keep it to one screen. |

## Check what you get

Claude can be wrong, and it can sound sure when it is. Check facts, numbers and citations before you rely on them, ask for sources when they matter, and run any code it writes. For a QA engineer this is the familiar rule: treat output as untested until you have tested it.

## The desktop app

The Claude desktop app has separate modes for three kinds of work: chatting, handing Claude multi-step work on files on your computer, and coding with Claude Code. Pick the mode by what you want back: an answer, finished work on your files, or changes to a code repository.
