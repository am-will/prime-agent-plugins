# Try Cua Driver

This is the `cua-driver-mcp` Prime Agent integration for an existing [Try Cua Cua Driver](https://github.com/trycua/cua) installation.

It adds a Python-backed Prime Agent skill that connects to the local `cua-driver mcp` server. The plugin is intentionally only an adapter: it does not include, vendor, or redistribute Cua Driver source code, binaries, or assets.

## Prerequisite

Install and configure Cua Driver from the upstream project first:

- [Try Cua Cua Driver repository](https://github.com/trycua/cua)
- [Cua Driver installation and CLI documentation](https://cua.ai/driver)

The skill uses the `cua-driver` executable on `PATH` by default and honors the `cua-driver` stdio entry in `~/.prime/agent/settings.json` when one is configured.

## Cua Driver 0.19 browser control

This integration requires Cua Driver `0.19.0` or newer:

```bash
cua-driver --version
cua-driver skills update
```

After installing or updating, restart Prime Agent or run `/reload`. The Python bridge exposes every live MCP tool and provides concrete methods for the typed browser surface: `get_browser_state`, `browser_prepare`, `browser_navigate`, `browser_click`, `browser_type`, `browser_pointer`, `browser_dialog`, `browser_set_input_files`, and `browser_download`.

For page work, use the upstream [Drive a Web Page workflow](https://cua.ai/docs/how-to-guides/driver/drive-a-web-page): start one session, bind the exact `(pid, window_id)`, snapshot with `semantic_v2`, act only with fresh refs, snapshot again to verify, and end the session. Use native window tools for browser chrome and unsupported browser engines.

## Install the Prime Agent integration

Install the whole collection:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```

Restart Prime Agent, or run `/reload`, then invoke the skill as `cua-driver-mcp`.

## Upstream attribution

Cua Driver is an upstream project of [Cua AI, Inc.](https://github.com/trycua) and is licensed under the MIT License. See the [upstream `trycua/cua` repository](https://github.com/trycua/cua) for its source, releases, license, and documentation. This Prime Agent plugin is an independent integration layer and is not affiliated with or endorsed by Try Cua.
