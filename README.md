# Prime Agent Plugins

Prime Agent Plugins is a collection of installable [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) plugins. Each plugin lives under `plugins/`; the root package manifest loads the collection as one capability package. The collection includes both native extensions and Python-backed skills that connect to tools already installed on the user's machine.

## Install from GitHub

Install the collection for every project:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```

Install it only for the current project:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins --local
```

Prime Agent discovers the plugin directories from the root `pi` manifest. Restart Prime Agent, or run `/reload`, after installing.

For a manual copy of only the ask-user extension:

```bash
mkdir -p ~/.prime/agent/extensions
curl -fsSL https://raw.githubusercontent.com/am-will/prime-agent-plugins/main/plugins/ask-user/extensions/ask-user.ts \
  -o ~/.prime/agent/extensions/ask-user.ts
```

Review plugins before loading them: Prime Agent extensions run with your user permissions.

## Included plugins

### ask_user

The first Prime Agent Plugins entry is `ask_user`, a focused multiple-choice question tool that always adds an `Other (type your own answer)` choice. Selecting it opens a freeform input. An optional `context` string travels with the answer metadata without being shown in the question UI. Results identify whether the answer came from a listed option or freeform input.

Source: [plugins/ask-user](plugins/ask-user)

Tool input:

```json
{
  "question": "Which release channel should I use?",
  "context": "The release will start with a small pilot.",
  "options": ["Stable", "Beta"]
}
```

The `question` is required and may be up to 4,000 characters. `context` is optional and may be up to 8,000 characters; it is returned with the answer metadata but is not shown in the question UI. `options` must contain 2–12 non-empty choices, each up to 500 characters. Results include `answerSource: "option"` or `answerSource: "freeform"`.

### trycua

The `trycua` plugin adds a Python-backed `cua-driver-mcp` skill for people who already use [Try Cua's Cua Driver](https://github.com/trycua/cua). It connects to the local `cua-driver mcp` executable and exposes the upstream driver's native tools through Prime Agent. It does not contain or redistribute Cua Driver source code, binaries, or assets.

Install Cua Driver from the [upstream project](https://github.com/trycua/cua) first, then install this collection and restart Prime Agent (or run `/reload`). The bridge defaults to `~/.local/bin/cua-driver mcp` and honors a configured `cua-driver` stdio server in `~/.prime/agent/settings.json`.

See the [trycua plugin README](plugins/trycua/README.md) and [cua-driver-mcp skill](plugins/trycua/skills/cua-driver-mcp/SKILL.md) for usage and attribution. Cua Driver is maintained by Cua AI, Inc. and is MIT-licensed; this collection is an independent integration layer.

## Requirements

- Prime Agent 0.7 or newer
- An interactive Prime Agent client for answering questions

Prime Agent provides inherited `@earendil-works/pi-coding-agent` and `typebox` modules at runtime; this collection does not bundle them.

## Adding a plugin

Add the plugin source under `plugins/<name>/`, then add its extension and/or skill directories to the root `pi.extensions` and `pi.skills` lists in `package.json`. Keeping each plugin in its own directory makes the collection easy to inspect and extend.

## License

MIT. See [LICENSE](LICENSE).
