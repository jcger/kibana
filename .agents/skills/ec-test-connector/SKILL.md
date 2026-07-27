---
name: ec-test-connector
description: Tests a live Kibana connector by exercising all its actions via the elastic-agent-builder MCP, going from generic (list/search) to specific (get by ID), with full parameter coverage including pagination. Outputs a pass/warn/fail summary.
allowed-tools: Read, Glob, Bash, WebSearch, mcp__elastic-agent-builder__platform_core_execute_connector_sub_action, mcp__elastic-agent-builder__platform_core_generate_workflow, mcp__elastic-agent-builder__platform_core_execute_workflow, mcp__elastic-agent-builder__platform_core_get_workflow_execution_status
argument-hint: [connector-name]
---

# Test Connector: $0

This skill exercises a live, configured Kibana connector end-to-end through the
`elastic-agent-builder` MCP. It reads the connector spec to discover all actions,
orders them from least to most dependent, chains results between calls, and
produces a coverage summary with pass/warn/fail for each action.

## Prerequisites

Confirm before starting (ask the user if not already provided):

- **Connector ID** — the runtime instance ID in Kibana. Find it under
  Stack Management → Connectors → click the connector → copy the ID from the URL
  or the details panel.
- **Worktree path** — path to the connector's git worktree (or the kibana-fork root).
  Defaults to the current working directory.

If the connector ID is not yet available (environment not set up), stop here and
tell the user to run this skill again once the SRE has confirmed the account.

---

## Step 1: Read the Connector Spec

Locate and read the connector's source files from the worktree or kibana-fork:

```
src/platform/packages/shared/kbn-connector-specs/src/specs/<connector_name>/
  ├── <connector_name>.ts   ← action definitions, subAction names
  └── types.ts              ← Zod schemas for each action's inputs
```

Use Glob to find them if the path isn't obvious:
```
Glob: src/platform/packages/shared/kbn-connector-specs/src/specs/**/<connector_name>.ts
```

From these files, extract for each action:
- **subAction name** — the string passed to `callToolJson`/`callToolContent` (snake_case)
- **Required params** — Zod `.required()` fields in the input schema
- **Optional params** — remaining Zod fields (pagination, filters, etc.)
- **Return shape** — what the action is documented to return (IDs, items, cursors)

---

## Step 2: Build a Tiered Test Plan

Classify each action into a tier based on dependencies:

**Tier 1 — Independent (no prior data needed)**
- Naming patterns: `list*`, `search*`, `query*`, `find*`, `browse*`, `get*All`
- Use minimal/default params: empty query string, small page size (e.g. `limit: 5`),
  no filter unless required.
- Goal: confirm the action reaches the service and returns data.
- **Also run a paginated variant** if the action accepts cursor/token/offset params.

**Tier 2 — Dependent (requires IDs from Tier 1)**
- Naming patterns: `get*`, `fetch*`, `read*`, `download*`, `describe*`
- Use the first ID/key/path returned from the corresponding Tier 1 call.
- If Tier 1 returned zero results, mark the Tier 2 action as SKIP with a note.

**Tier 3 — Parameterized coverage**
- Re-run Tier 1 actions with non-default parameter combinations:
  - Different page sizes (e.g. `limit: 1` to force pagination)
  - A non-empty search query if the action accepts one
  - Date-range filters if available
- Goal: confirm optional parameters are wired up correctly, not silently ignored.

Write out the full plan before executing anything:
```
Tier 1: search (empty query), listFolders (root), ...
Tier 2: getFile (id=<from search>), getFolder (id=<from listFolders>), ...
Tier 3: search (query="test", limit=1), listFolders (pageSize=2, cursor=<token>), ...
```

---

## Step 3: Execute Each Action

For every action in tier order, call:

```
mcp__elastic-agent-builder__platform_core_execute_connector_sub_action
  connectorId: <connector-id>
  subAction: <subAction-name>
  params: <constructed-params>
```

**Parameter construction rules:**
- Required fields: supply the most generic valid value (empty string, `*`, `root`, `0`).
  If a required field needs a real ID (Tier 2), use the value from the Tier 1 result.
- Optional pagination fields: always include them on the paginated Tier 1 / Tier 3 runs.
  Use the cursor/token from a prior call for the second-page variant.
- Never invent IDs. If a required ID is not available from prior results, mark the
  action SKIP and explain why.

**Result classification:**
- ✅ **PASS** — response contains expected data structure (items array, object with fields, etc.)
- ⚠️ **WARN** — response is valid but empty (e.g. `items: []`), or succeeded but returned
  less data than expected (e.g. pagination token missing despite `limit < total`)
- ❌ **FAIL** — response contains an `error` field, HTTP error, or the MCP call threw
- ⏭️ **SKIP** — could not test because a required dependency (ID, account data) was unavailable

After each call, extract any values needed for subsequent tiers:
- IDs, names, paths, cursors, tokens → store them labelled for use in Tier 2/3 prompts.

---

## Step 4: Converse-Style Sanity Check (optional but recommended)

After the direct action tests, generate and execute a short Agent Builder workflow
that uses `agent_converse` to ask an AI agent to try the connector in a natural way:

```
mcp__elastic-agent-builder__platform_core_generate_workflow
  query: "Test the $0 connector. Use it to find and retrieve one document or item,
          starting with a broad search, then fetching one specific result by ID.
          Report what you found."
```

Then execute the generated workflow:
```
mcp__elastic-agent-builder__platform_core_execute_workflow
  attachmentId: <id from generate_workflow response>
  waitForCompletion: true
```

Include the workflow's natural-language output in the summary as a "smoke test" result.
This validates the full stack (connector plumbing, schema rendering, AI discoverability)
beyond what direct sub-action calls can test.

---

## Step 5: Output the Summary

Print a markdown report with the following sections:

```markdown
# $0 Connector Test Report

**Connector ID:** <id>
**Branch / worktree:** <path>
**Tested by:** ec-test-connector skill

---

## Action Coverage

| Tier | Action | Sub-Action | Key Params | Result | Notes |
|------|--------|-----------|------------|--------|-------|
| 1    | search | search    | query="", limit=5 | ✅ PASS | 12 results returned |
| 1    | search (paginated) | search | cursor=<tok>, limit=5 | ✅ PASS | page 2 ok |
| 2    | getFile | getFile | id=abc123 | ✅ PASS | metadata returned |
| 2    | getSharedLink | getSharedLink | id=abc123 | ❌ FAIL | 403 Forbidden |
| 3    | search (filtered) | search | query="report", limit=1 | ⚠️ WARN | empty result |

---

## Agent Converse Smoke Test

> <paste the workflow's natural-language output here>

---

## Summary

| | Count |
|--|--|
| ✅ Pass | N |
| ⚠️ Warn | N |
| ❌ Fail | N |
| ⏭️ Skip | N |
| **Total** | **N** |

---

## Coverage Gaps

- List any actions that could not be tested and why.
- Note any optional parameters that were not exercised.
- Flag any Tier 2 actions that were skipped due to empty Tier 1 results.

---

## Recommended Next Steps

- For each ❌ FAIL: quote the error message and suggest likely cause
  (auth scope missing, param name mismatch, service API change, etc.)
- For each ⚠️ WARN: note whether empty response is expected or suspicious
```
