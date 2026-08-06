import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const AskUserParameters = Type.Object({
  question: Type.String({
    description: "The focused question to ask the user",
    minLength: 1,
    maxLength: 4_000,
  }),
  options: Type.Array(
    Type.String({ minLength: 1, maxLength: 500 }),
    {
      description: "The choices to present to the user",
      minItems: 2,
      maxItems: 12,
    },
  ),
});

export const OTHER_OPTION = "Other (type your own answer)";

export default function askUser(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "Ask user",
    description: "Ask the user a focused multiple-choice question, always include a freeform answer, and optionally collect additional context after the answer.",
    parameters: AskUserParameters,
    executionMode: "sequential",

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const options = params.options.includes(OTHER_OPTION) ? params.options : [...params.options, OTHER_OPTION];
      const details = {
        question: params.question,
        options: params.options,
      };
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "The user-question UI is not available in this mode." }],
          details: { ...details, answer: null },
        };
      }

      const selected = await ctx.ui.select(params.question, options, { signal });
      if (selected === undefined) {
        return {
          content: [{ type: "text", text: "The user cancelled the question." }],
          details: { ...details, answer: null, cancelled: true },
        };
      }

      const answerSource = selected === OTHER_OPTION ? "freeform" : "option";
      const answer = selected === OTHER_OPTION
        ? (await ctx.ui.input("Type your answer", "Your answer", { signal }))?.trim()
        : selected;
      if (!answer) {
        return {
          content: [{ type: "text", text: "The user did not provide an answer." }],
          details: { ...details, answer: null, answerSource, cancelled: true },
        };
      }

      const context = (await ctx.ui.input(
        "Add context (optional)",
        "Anything else to add?",
        { signal },
      ))?.trim();
      const answerLabel = answerSource === "freeform" ? "The user answered" : "The user selected";
      const contextText = context ? `\nAdditional context: ${context}` : "";

      return {
        content: [{ type: "text", text: `${answerLabel}: ${answer}${contextText}` }],
        details: { ...details, answer, answerSource, ...(context ? { context } : {}) },
      };
    },
  });
}
