---
name: cua-driver-mcp
description: Connect Prime Agent to Cua Driver 0.19 or newer through its local stdio MCP server, including the typed browser-control API. Use when the user asks for Cua Driver, Try Cua, Cua MCP, browser control, or native desktop automation through an existing Cua Driver installation.
license: MIT
---

# Cua Driver MCP

This skill is an integration adapter for the upstream [Try Cua Cua Driver](https://github.com/trycua/cua). It does not bundle or reimplement Cua Driver. The user must install Cua Driver separately and accept its upstream license and terms.

## Prerequisites

- Install Cua Driver using the [upstream installation instructions](https://cua.ai/driver).
- This adapter requires Cua Driver `0.19.0` or newer. Confirm it with `cua-driver --version`; the bridge also checks the configured upstream binary before opening MCP.
- Confirm the `cua-driver` executable is available on `PATH`, or configure a `cua-driver` stdio server in `~/.prime/agent/settings.json`.
- Restart Prime Agent after installing this Python-backed skill so its kernel can install the declared Python dependency and import the bridge.

## Usage

The Python module is `cua_driver_mcp`. Discover the server-defined tool set first:

```python
tools = await cua_driver_mcp.list_tools()
print([(tool["name"], tool["description"]) for tool in tools])
```

The bridge forwards every tool returned by the live MCP `tools/list` response. Use a direct method for a valid Python tool name or the explicit escape hatch for any current or future upstream tool:

```python
size = await cua_driver_mcp.get_screen_size()
result = await cua_driver_mcp.call_tool("list_apps", {})
```

## Browser control

The typed browser tools are exposed as concrete async methods, in addition to the dynamic forwarding above:

`get_browser_state`, `browser_prepare`, `browser_navigate`, `browser_click`, `browser_type`, `browser_pointer`, `browser_dialog`, `browser_set_input_files`, and `browser_download`.

Use one explicit session and the exact native window binding from the upstream [Drive a Web Page guide](https://cua.ai/docs/how-to-guides/driver/drive-a-web-page):

```python
session = "browser-run-1"
await cua_driver_mcp.start_session(session=session, capture_scope="auto")

# Discover a browser, then bind the exact (pid, window_id) from its native
# discovery records.
windows = await cua_driver_mcp.list_windows(pid=browser_pid)
binding = await cua_driver_mcp.get_browser_state(
    pid=browser_pid, window_id=window_id, session=session
)
assert binding["binding_quality"] == "exact"
assert binding["mutation_allowed"] is True

# Snapshot a returned tab and use only refs from this latest snapshot.
page = await cua_driver_mcp.get_browser_state(
    target_id=binding["target_id"],
    tab_id=binding["tabs"][0]["tab_id"],
    session=session,
    snapshot_format="semantic_v2",
)
await cua_driver_mcp.browser_navigate(
    target_id=binding["target_id"], tab_id=page["tab_id"],
    url="https://example.com", session=session,
)
page = await cua_driver_mcp.get_browser_state(
    target_id=binding["target_id"], tab_id=page["tab_id"],
    session=session, snapshot_format="semantic_v2",
)
await cua_driver_mcp.browser_click(
    target_id=binding["target_id"], tab_id=page["tab_id"],
    ref="<fresh ref>", session=session,
)
await cua_driver_mcp.end_session(session=session)
```

The live schemas are authoritative, so inspect `await cua_driver_mcp.list_tools()` before constructing arguments. The browser action families are:

- `browser_navigate`: navigate an exactly bound HTTP(S) or `about:` page.
- `browser_click`: click a fresh page ref, using trusted input by default or explicitly `input_route="dom_event"` where appropriate.
- `browser_type`: insert text or send keystrokes to a fresh editable ref; use `replace=True` when replacing existing content.
- `browser_pointer`: hover, right-click, double-click, scroll, or drag with a current ref.
- `browser_dialog`: inspect, accept, or dismiss a page-owned dialog.
- `browser_set_input_files`: assign one to 32 absolute regular-file paths to a current upload ref.
- `browser_download`: activate one exact download ref; the MCP host supplies its destructive approval.
- `browser_prepare`: perform an explicitly approved isolated or existing-profile setup only when `get_browser_state` reports `browser_requires_setup`.
- `get_browser_state`: bind an exact native browser window or return a fresh `semantic_v2` page snapshot.

Every new snapshot or navigation invalidates old refs and continuations. Take a fresh snapshot after each mutation and verify the expected state. Use native Cua Driver tools for browser chrome, permission prompts, file pickers, Safari, Firefox, and unsupported embedded webviews; typed page mutation is for the exact Chromium-family/Electron routes reported by the driver. The legacy `page` surface is read-only by default and is not a replacement for exact binding.

## Configuration

The bridge defaults to `~/.local/bin/cua-driver mcp`. If Prime Agent has a `cua-driver` stdio entry in `~/.prime/agent/settings.json`, the bridge honors its configured `command`, `args`, and string-valued `env` fields.

## Attribution

Upstream project: [trycua/cua](https://github.com/trycua/cua), maintained by Cua AI, Inc. Cua is MIT-licensed. This skill only connects to a user's existing upstream installation.
