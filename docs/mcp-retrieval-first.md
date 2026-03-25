# CloudMind MCP Retrieval-First Guide

## Goal

CloudMind MCP should act as a retrieval and evidence layer, not as a
full answer-orchestration layer.

The intended split is:

- CloudMind decides what can be retrieved and exposed
- CloudMind returns structured evidence and asset-level grouping
- The caller AI decides how to synthesize the final answer

This keeps CloudMind aligned with its memory-layer role and avoids
double-generation noise.

## Recommended Tool Order

Use this order by default when the user question may depend on private
history, project context, or prior decisions:

1. `search_assets_for_context`
2. `search_assets`
3. `get_asset`
4. `ask_library_for_context` or `ask_library` only as a shortcut

Recommended behavior:

- Prefer `search_assets_for_context` when you know the current work
  context, such as `coding`, `research`, `writing`, `general`, or
  `personal_review`
- Prefer `allowFallback=false` first
- Only rerun with `allowFallback=true` when the first pass is too thin
  and broader retrieval still matches the user intent
- Use `get_asset` only after retrieval has identified a specific asset
  worth expanding

## Primary Result View

For retrieval tools, the primary result view is `groupedEvidence`.

Consume results in this order:

1. `groupedEvidence`
2. `resultScope`
3. `indexingSummary`
4. `items`
5. `evidence.items`

Why `groupedEvidence` comes first:

- it ranks results at the asset level instead of the chunk level
- it keeps supporting evidence attached to the same asset
- it exposes `matchedLayers`, `groupSummary`, and evidence-level
  `matchReasons`
- it is easier for the caller AI to decide whether to cite, expand, or
  ignore an asset

Interpretation guidance:

- `groupedEvidence` is the main planning surface
- `items` is a flattened compatibility view
- `evidence.items` is the drill-down layer for fine-grained inspection
- `resultScope` tells the caller whether results stayed inside the
  preferred context or were widened by fallback

## Tool Positioning

### Primary tools

- `search_assets`
- `search_assets_for_context`
- `get_asset`
- `save_asset`

These are the main tools for retrieval-first workflows.

### Secondary tools

- `list_assets`
- `update_asset`
- `delete_asset`
- `reprocess_asset`
- `list_asset_workflows`
- `get_workflow_run`

These support browsing, maintenance, and workflow inspection.

### Convenience tools

- `ask_library`
- `ask_library_for_context`

These tools are still useful, but they should be treated as shortcut
summary tools rather than the default path.

Use them when:

- you want a quick grounded summary
- you do not need the caller AI to tightly control final phrasing
- you do not need a multi-step retrieval and expansion plan

Do not prefer them when:

- you need strong citation control
- you want to decide which assets are actually used
- you want retrieval first, then selective expansion
- you are building a multi-step AI workflow

## Example Caller Strategy

For most AI clients, the recommended loop is:

1. decide whether user-specific context is likely useful
2. call `search_assets_for_context`
3. inspect `groupedEvidence`
4. optionally call `get_asset` for one or two selected assets
5. synthesize the final answer in the caller model

This is the default CloudMind MCP strategy going forward.
