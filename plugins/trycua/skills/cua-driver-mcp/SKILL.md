---
name: cua-driver-mcp
description: Connect Prime Agent to an already-installed Try Cua Cua Driver through its local stdio MCP server and expose the driver's native computer-use tools. Use when the user asks for Cua Driver, Try Cua, Cua MCP, or native desktop automation through an existing Cua Driver installation.
license: MIT
compatibility: Requires the upstream Cua Driver executable and an interactive Prime Agent kernel with Python-backed skill support.
---

# Cua Driver MCP

This skill is an integration adapter for the upstream [Try Cua Cua Driver](https://github.com/trycua/cua). It does not bundle or reimplement Cua Driver. The user must install Cua Driver separately and accept its upstream license and terms.

## Prerequisites

- Install Cua Driver using the [upstream installation instructions](https://cua.ai/driver).
- Confirm the `cua-driver` executable is available on `PATH`, or configure a `cua-driver` stdio server in `~/.prime/agent/settings.json`.
- Restart Prime Agent after installing this Python-backed skill so its kernel can install the declared Python dependency and import the bridge.

## Usage

The Python module is `cua_driver_mcp`. Discover the server-defined tool set first:

```python
tools = await cua_driver_mcp.list_tools()
print([(tool["name"], tool["description"]) for tool in tools])
```

Call a native Cua Driver tool through the bridge:

```python
size = await cua_driver_mcp.get_screen_size()
result = await cua_driver_mcp.call_tool("list_apps", {})
```

For GUI actions, follow the upstream Cua Driver behavior: snapshot before acting, use fresh element identifiers, and verify with a fresh snapshot afterward.

## Configuration

The bridge defaults to `~/.local/bin/cua-driver mcp`. If Prime Agent has a `cua-driver` stdio entry in `~/.prime/agent/settings.json`, the bridge honors its configured `command`, `args`, and string-valued `env` fields.

## Attribution

Upstream project: [trycua/cua](https://github.com/trycua/cua), maintained by Cua AI, Inc. Cua is MIT-licensed. This skill only connects to a user's existing upstream installation.
