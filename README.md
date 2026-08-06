# Prime Agent Ask User

`ask_user` is a small Prime Agent extension that lets an agent pause for a focused multiple-choice answer. It works in Prime Agent's native interactive CLI and in clients that bridge Prime Agent's extension UI, including Prime Work.

## Install from GitHub

Install it for every project:

```bash
prime-agent package install https://github.com/am-will/prime-agent-ask-user
```

Install it only for the current project:

```bash
prime-agent package install https://github.com/am-will/prime-agent-ask-user --local
```

Prime Agent installs the package under its capability-package directory and discovers the extension from the `pi` manifest. Restart Prime Agent, or run `/reload`, after installing.

For a manual copy into the global extension directory:

```bash
mkdir -p ~/.prime/agent/extensions
curl -fsSL https://raw.githubusercontent.com/am-will/prime-agent-ask-user/main/extensions/ask-user.ts \
  -o ~/.prime/agent/extensions/ask-user.ts
```

The manual copy is useful when you want the source file directly. Review the file before loading any third-party extension: Prime Agent extensions run with your user permissions.

## Tool contract

The extension registers a sequential tool named `ask_user`:

```json
{
  "question": "Which release channel should I use?",
  "context": "This changes the default audience for the next deployment.",
  "options": ["Stable", "Beta"]
}
```

`question` is required and may be up to 4,000 characters. `context` is optional and may be up to 4,000 characters; interactive clients show it alongside the question to help the user decide. `options` must contain 2–12 non-empty choices, each up to 500 characters. The tool returns the selected string, or a cancellation/no-UI result when the user dismisses the prompt or the runtime has no interactive UI.

Non-interactive modes such as `--print` and JSON mode do not have a question UI, so the tool reports that it is unavailable instead of blocking.

## Requirements

- Prime Agent 0.7 or newer
- An interactive Prime Agent client for answering questions

Prime Agent provides the inherited `@earendil-works/pi-coding-agent` and `typebox` modules at runtime; this package does not bundle them.

## License

MIT. See [LICENSE](LICENSE).
