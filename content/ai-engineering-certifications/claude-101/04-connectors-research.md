# Connectors, enterprise search & Research

The third section of Claude 101 covers expanding Claude's reach beyond the chat.

## Connectors

- Connectors let Claude access your apps and services, retrieve data and take actions there. For example, Claude can create issues in Linear, send messages in Slack or search files in Google Drive.
- Claude **inherits your permissions** in the connected service. It sees what you can see, and nothing more.
- Connectors are built on the Model Context Protocol (MCP), an open standard. Besides the prebuilt directory, you can add a custom connector that points to a remote MCP server.
- On Team and Enterprise plans an Owner or Primary Owner has to enable a connector before members can use it.
- Connectors work across Claude on the web, the desktop app, Claude Code and the API.

## Research

- With Research, Claude investigates a question in depth. It runs several searches that build on each other and decides what to look into next from what it finds.
- It searches the web and your connected tools, such as Google Workspace, and can use connector tools without asking for approval each time.
- Web search must be turned on. Research needs a paid plan: Pro, Max, Team or Enterprise.
- Started from the mobile app, Research searches only the web and skips your connectors.
- The result is a report with citations, so you can check each claim.

## Enterprise search

- Available on Team and Enterprise plans. An owner completes the setup before members can use it.
- It is a dedicated project for searching across your organization's connected tools, such as SharePoint, Slack, Gmail and Google Drive.
- Claude combines what it finds into one answer with source citations.

## Choosing the right feature

| Request | Best fit |
| --- | --- |
| "Answer from our 40-page test strategy every time" | Project knowledge |
| "Format every bug report the same way" | A skill |
| "Create the Jira ticket for this bug" | A connector |
| "Compare three test-management tools, with sources" | Research |
| "What did we decide about flaky-test quarantine across Slack and Drive?" | Enterprise search |
