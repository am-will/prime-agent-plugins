# Ask User

This is the `ask_user` plugin in the [Prime Agent Plugins](https://github.com/am-will/prime-agent-plugins) collection.

It asks a focused multiple-choice question and always adds an `Other (type your own answer)` choice.

Interaction:

1. Select a listed answer, or select `Other (type your own answer)` and type an answer.
2. Type any additional context in the `Add context (optional)` field.
3. Submit the context, or leave it blank/cancel it to submit only the answer.

Context is user-entered follow-up text, not a caller-supplied tool parameter.

The user-entered context is returned with the answer in both the tool content and the `details.context` field.

The root collection is installed with:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```
