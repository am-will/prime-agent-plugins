# Ask User

This is the `ask_user` plugin in the [Prime Agent Plugins](https://github.com/am-will/prime-agent-plugins) collection.

It asks one to five focused multiple-choice questions in one keyboard-driven interaction and always adds an `Other (type your own answer)` choice to each question.

Interaction:

1. Use the arrows or number keys to choose an answer.
2. Start typing at any point to add context. The UI shows `Type to add context` and keeps the text under the options; when `Other` is selected, the freeform text appears in that row.
3. Use the arrows to move back through questions. After the last question, choose `Submit answers`.

The tool accepts up to five questions per call. If more are needed, the agent can call it again. Context is user-entered follow-up text, not a caller-supplied tool parameter.

The user-entered context is returned with its answer in both the tool content and that answer's `details.answers[].context` field.

The root collection is installed with:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```
