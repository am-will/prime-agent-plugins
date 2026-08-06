import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const AskUserParameters = Type.Object({
  question: Type.String({
    description: "The focused question to ask the user",
    minLength: 1,
    maxLength: 4_000,
  }),
  context: Type.Optional(Type.String({
    description: "Optional context that helps the user answer the question",
    minLength: 1,
    maxLength: 4_000,
  })),
  options: Type.Array(
    Type.String({ minLength: 1, maxLength: 500 }),
    {
      description: "The choices to present to the user",
      minItems: 2,
      maxItems: 12,
    },
  ),
});

export function formatAskUserTitle(question: string, context?: string): string {
  const contextText = context?.trim();
  return contextText ? `${question}\n\nContext:\n${contextText}` : question;
}

export default function askUser(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "Ask user",
    description: "Ask the user a focused multiple-choice question, optionally with context, and wait for their choice before continuing.",
    parameters: AskUserParameters,
    executionMode: "sequential",

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "The user-question UI is not available in this mode." }],
          details: { question: params.question, context: params.context, options: params.options, answer: null },
        };
      }

      const answer = await ctx.ui.select(formatAskUserTitle(params.question, params.context), params.options, { signal });
      if (answer === undefined) {
        return {
          content: [{ type: "text", text: "The user cancelled the question." }],
          details: { question: params.question, context: params.context, options: params.options, answer: null, cancelled: true },
        };
      }

      return {
        content: [{ type: "text", text: `The user selected: ${answer}` }],
        details: { question: params.question, context: params.context, options: params.options, answer },
      };
    },
  });
}
