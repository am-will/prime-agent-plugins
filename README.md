# Prime Plugins

Prime Plugins is a collection of installable [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) plugins. Each plugin lives under `plugins/`; the root package manifest loads the collection as one capability package.

## Install from GitHub

Install the collection for every project:

```bash
prime-agent package install https://github.com/am-will/prime-plugins
```

Install it only for the current project:

```bash
prime-agent package install https://github.com/am-will/prime-plugins --local
```

Prime Agent discovers the plugin directories from the root `pi` manifest. Restart Prime Agent, or run `/reload`, after installing.

For a manual copy of only the ask-user extension:

```bash
mkdir -p ~/.prime/agent/extensions
curl -fsSL https://raw.githubusercontent.com/am-will/prime-plugins/main/plugins/ask-user/extensions/ask-user.ts \
  -o ~/.prime/agent/extensions/ask-user.ts
```

Review plugins before loading them: Prime Agent extensions run with your user permissions.

## Included plugins

### ask_user

The first Prime Plugins entry is `ask_user`, a focused multiple-choice question tool that always adds an `Other (type your own answer)` choice. Selecting it opens a freeform input. Results identify whether the answer came from a listed option or freeform input.

Source: [plugins/ask-user](plugins/ask-user)

Tool input:

```json
{
  "question": "Which release channel should I use?",
  "options": ["Stable", "Beta"]
}
```

The `question` is required and may be up to 4,000 characters. `options` must contain 2–12 non-empty choices, each up to 500 characters. Results include `answerSource: "option"` or `answerSource: "freeform"`.

## Requirements

- Prime Agent 0.7 or newer
- An interactive Prime Agent client for answering questions

Prime Agent provides inherited `@earendil-works/pi-coding-agent` and `typebox` modules at runtime; this collection does not bundle them.

## Adding a plugin

Add the plugin source under `plugins/<name>/`, then add its extension directory to the root `pi.extensions` list in `package.json`. Keeping each plugin in its own directory makes the collection easy to inspect and extend.

## License

MIT. See [LICENSE](LICENSE).
