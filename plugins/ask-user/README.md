# Ask User

This is the `ask_user` plugin in the [Prime Agent Plugins](https://github.com/am-will/prime-agent-plugins) collection.

It asks one to five focused multiple-choice questions in one keyboard-driven interaction and always presents one canonical `Other (type your own answer)` choice for each question. Incoming labels such as `Something else (freeform)` are normalized so the UI never shows both variants.

Interaction:

1. Use the arrows or number keys to choose an answer.
2. Start typing at any point. A single full-width field under the choices is labeled `Type to add context`; for a listed choice its text is returned as context, and for `Other` its text is returned as the answer.
3. Use the arrows or Tab/Shift-Tab to move between questions. In an interactive Pi or Prime Agent client that exposes custom extension UI, the questionnaire stays in one TUI panel; after the last question choose `Submit answers`.

The tool accepts up to five questions per call. If more are needed, the agent can call it again. Context is user-entered follow-up text, not a caller-supplied tool parameter.

For a listed choice, user-entered text is returned with its answer in both the tool content and that answer's `details.answers[].context` field. For `Other`, the same field supplies the freeform answer and no separate input row is shown.

GooeyPi's GUI/RPC adapter groups the questionnaire requests into one modal. A connection-backed TUI that only exposes the standard `select` API cannot host arbitrary custom components; that client limitation is outside the plugin and falls back to its native selector behavior.

GooeyPi bundles and manages its own copy of this extension so one in-app toggle can control `ask_user` across Prime, OMP, and Pi. When the collection is also installed in a CLI runtime, the standalone extension detects the GooeyPi-managed environment and defers to the bundled copy instead of registering the tool twice. Outside GooeyPi, the installed collection continues to provide `ask_user` normally.

The root collection is installed with:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```

Base Pi uses the same package manifest:

```bash
pi install https://github.com/am-will/prime-agent-plugins
```
