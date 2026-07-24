---
name: cloudmind-memory
description: Use CloudMind MCP as selective long-term memory. Use when a task may benefit from the user's preferences or history, prior project decisions or progress, the user asks to remember, correct, forget, restore, or archive something, or durable agent work should be preserved for a later session. Apply its safety rules when a memory request contains secrets, raw transient material, or uncertain claims; skip it for ordinary casual chat and self-contained tasks.
---

# CloudMind Memory

Use CloudMind selectively. Recall context when it can change the work, and save only
information that remains useful across sessions. Never treat this workflow as automatic
conversation capture.

## Workflow

1. Confirm that the CloudMind MCP server and required tool are available. Do not imitate a
   successful memory operation when the server is unavailable.
2. Before any project recall or write, run `git config --get remote.origin.url` and derive the
   current `contextKey`. Do not infer it from the local folder name.
3. Recall relevant memories once, using 1 to 5 focused queries in one batched call.
4. Complete the user's task. Prefer current user instructions and current source evidence when
   they conflict with recalled content.
5. At a durable boundary, decide whether to create, update, forget, restore, archive, or skip.

Do not block an ordinary task only because CloudMind is unavailable. Mention the missing memory
operation when it affects continuity or when the user explicitly requested that operation.

## Derive Project Context

Use `global` only for information that genuinely applies across projects.

For Git projects, read the canonical remote with `git config --get remote.origin.url` and
normalize it:

- `git@github.com:OWNER/REPO.git` or `https://github.com/OWNER/REPO.git` becomes
  `project:github:OWNER/REPO`.
- For another provider, use `project:<provider>:<owner-or-group>/<repo>`.
- Strip the protocol, credentials, query, fragment, trailing slash, and `.git` suffix.
- Preserve the repository path's meaningful case. Lowercase the provider name.
- Never use an absolute local path as a project key.

When no stable remote exists, do not silently store project-specific information under `global`.
Continue the task, and request a stable key only if a project memory must be written.

## Recall Before Work

Recall when previous context can materially affect the answer or implementation:

- Use `recall` for the user's preferences, background, explicit decisions, and personal history.
  Pass `recordKinds: ["memory"]`, `scopeIds: ["personal"]`, and focused `queries`. In a project,
  use `contextKeys: ["global", "<project-context-key>"]`; outside a project, use
  `contextKeys: ["global"]`.
- Use `recall_agent` for prior project decisions, completed work, blockers, debugging trails, and
  next steps. Pass `recordKinds: ["memory"]`, `scopeIds: ["personal", "agent"]`, and exactly the
  current project in `contextKeys`.
- Always pass plural `contextKeys` for project recall. Never rely on `recall_agent`'s global
  default, and do not call it until the stable project key is known.
- Use both calls when user context and project continuation are independently relevant.
- Batch 1 to 5 short query facets in each call. Do not call recall repeatedly in a loop.
- Continue normally when no relevant memory is returned.

Skip recall for self-contained factual questions, casual chat, and work whose answer cannot be
improved by user or project history.

## Choose The Write Operation

Before writing, recall the target scope and exact context to check for an existing memory.

- Use `remember` when the user explicitly asks to remember a fact, preference, convention, or
  decision. This writes personal memory. Use the current project key when the request is
  project-specific; otherwise use `global`.
- Use `remember_agent` when the agent reaches a durable project boundary: a meaningful decision,
  completed result, verified progress point, unresolved blocker, or concrete next step. Use the
  project key for project work.
- Use `update_memory` when new information replaces or corrects an existing memory. Supply the
  exact returned `id`, `scopeId`, and `contextKey`. Fetch the current asset first when needed,
  because `content` must describe the complete replacement version.
- Use `save_asset` with personal scope when the user explicitly asks to archive a full
  conversation or source document. Full transcripts belong to `library`, not memory.
- Skip the write when the same durable meaning already exists.

Write concise, self-contained content that explains what remains true and why it matters. Include
stable evidence such as a commit or accepted result only when it will help later work. Merge
closely related progress facts into one useful status memory instead of creating a turn-by-turn
log.

## Forget And Restore

- Call `forget` only when the user explicitly asks to remove a specific memory. Resolve ambiguity
  before acting. Use the exact `id`, `scopeId`, and `contextKey`.
- Keep the default soft mode unless the user explicitly requests permanent deletion. Soft forget
  can be reversed with `restore_memory`.
- Treat hard mode as irreversible. Use it only for an already soft-forgotten memory after the user
  explicitly confirms permanent deletion of that exact ID; pass `confirmId` equal to `id`.
- Call `restore_memory` only for a specifically identified soft-forgotten memory.
- Never delete, hard-delete, or restore memories as routine cleanup.

## Safety And Quality

Never store:

- passwords, API keys, access tokens, session cookies, private keys, or recovery codes;
- complete conversations unless the user explicitly requests library archival;
- temporary logs, command output, stack traces, or routine turn-by-turn narration;
- generic public knowledge that belongs in a knowledge source;
- uncertain inference, speculation, or a claim contradicted by current evidence.

Honor an explicit request not to use memory. Let CloudMind apply its visibility classification by
default, and set `visibility` only when the user gives a clear privacy preference.

## Decision Examples

| Situation | Action |
| --- | --- |
| "Remember that this repo uses pnpm." | `remember` with personal scope and the project key |
| "Continue the M7 release work." | `recall_agent` with the project key before working |
| A verified release step completes | `remember_agent` once with result and next step |
| "Correction: this repo uses npm now." | Recall the exact memory, then `update_memory` |
| "Archive this whole conversation." | `save_asset` as a personal library asset |
| "Remember this API token." | Refuse to store the secret |
| A self-contained factual question | No memory call |
