# Ask User

This is the `ask_user` plugin in the [Prime Agent Plugins](https://github.com/am-will/prime-agent-plugins) collection.

It asks a focused multiple-choice question, always adds an `Other (type your own answer)` choice, and collects a freeform answer when that choice is selected. After the answer is chosen or entered, the user can add optional context in a second input. Leave that field blank or cancel it to submit only the answer.

The user-entered context is returned with the answer in both the tool content and the `details.context` field.

The root collection is installed with:

```bash
prime-agent package install https://github.com/am-will/prime-agent-plugins
```
