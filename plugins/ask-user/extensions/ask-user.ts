import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const MAX_CONTEXT_LENGTH = 8_000;
const MAX_ANSWER_LENGTH = 8_000;
const OTHER_OPTION = "Other (type your own answer)";

const AskQuestionSchema = Type.Object({
  question: Type.String({
    description: "The question to ask the user",
    minLength: 1,
    maxLength: 4_000,
  }),
  options: Type.Array(
    Type.String({ minLength: 1, maxLength: 500 }),
    {
      description: "The choices to present for this question",
      minItems: 2,
      maxItems: 12,
    },
  ),
});

const AskUserParameters = Type.Object({
  questions: Type.Array(AskQuestionSchema, {
    description: "One to five questions to ask in a single questionnaire",
    minItems: 1,
    maxItems: 5,
  }),
});

type AskQuestion = {
  question: string;
  options: string[];
};

type Answer = {
  question: string;
  answer: string;
  answerSource: "option" | "freeform";
  context?: string;
};

type QuestionnaireResult = {
  answers: Answer[];
  cancelled: boolean;
};

type EncodedAnswer = {
  answer: string;
  answerSource: "option" | "freeform";
  context?: string;
};

/** Marker used by Prime Work's RPC UI adapter to group concurrent question requests. */
export const ASK_USER_RPC_MARKER = "__prime_ask_user__";
export { OTHER_OPTION };

function trimValue(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function normalizeQuestions(questions: AskQuestion[]): AskQuestion[] {
  return questions.map((question) => ({
    question: question.question,
    options: normalizeOptions(question.options),
  }));
}

function isOtherOption(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "other"
    || normalized.startsWith("other (")
    || normalized.startsWith("other:")
    || normalized === "something else"
    || normalized.startsWith("something else (")
    || normalized === "something different"
    || normalized.startsWith("something different (")
    || normalized === "none of the above"
    || normalized === "freeform";
}

function normalizeOptions(options: string[]): string[] {
  const normalized: string[] = [];
  let hasOther = false;
  for (const option of options) {
    if (isOtherOption(option)) {
      if (!hasOther) {
        normalized.push(OTHER_OPTION);
        hasOther = true;
      }
      continue;
    }
    normalized.push(option);
  }
  if (!hasOther) normalized.push(OTHER_OPTION);
  return normalized;
}

function createGroupId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function decodeRpcAnswer(value: string, question: AskQuestion): EncodedAnswer {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const answer = trimValue(typeof record.answer === "string" ? record.answer : undefined, MAX_ANSWER_LENGTH);
      const answerSource = record.answerSource === "freeform" ? "freeform" : record.answerSource === "option" ? "option" : undefined;
      if (answer && answerSource) {
        const context = trimValue(typeof record.context === "string" ? record.context : undefined, MAX_CONTEXT_LENGTH);
        return { answer, answerSource, ...(context ? { context } : {}) };
      }
    }
  } catch {
    // Older or generic RPC clients may return the selected label directly.
  }

  const answer = trimValue(value, MAX_ANSWER_LENGTH) ?? "";
  return {
    answer,
    answerSource: question.options.includes(answer) && answer !== OTHER_OPTION ? "option" : "freeform",
  };
}

function answerResult(questions: AskQuestion[], result: QuestionnaireResult) {
  const details = {
    questions,
    answers: result.answers,
    cancelled: result.cancelled,
  };

  if (result.cancelled) {
    return {
      content: [{ type: "text" as const, text: "The user cancelled the questionnaire." }],
      details,
    };
  }

  const text = result.answers.map((answer, index) => {
    const label = answer.answerSource === "freeform" ? "The user answered" : "The user selected";
    const context = answer.context ? `\nAdditional context: ${answer.context}` : "";
    return `${index + 1}. ${label}: ${answer.answer}${context}`;
  }).join("\n\n");

  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

async function askThroughRpc(ctx: ExtensionContext, questions: AskQuestion[], signal: AbortSignal | undefined): Promise<QuestionnaireResult> {
  const groupId = createGroupId();
  const values = await Promise.all(questions.map((question, index) => ctx.ui.select(
    question.question,
    [`${ASK_USER_RPC_MARKER}${groupId}:${index}:${questions.length}`, ...question.options],
    { signal },
  )));

  if (values.some((value) => value === undefined)) {
    return { answers: [], cancelled: true };
  }

  const answers = values.map((value, index) => {
    const decoded = decodeRpcAnswer(value as string, questions[index]);
    return { question: questions[index].question, ...decoded };
  });
  return { answers, cancelled: answers.some((answer) => !answer.answer) };
}

async function askWithCustomUi(
  ctx: ExtensionContext,
  questions: AskQuestion[],
  signal: AbortSignal | undefined,
): Promise<QuestionnaireResult | undefined> {
  if (typeof ctx.ui.custom !== "function") return undefined;

  try {
    return await ctx.ui.custom<QuestionnaireResult>((tui, theme, _keybindings, done) => {
      const contextInputs = questions.map(() => new Input());
      const selectedIndexes = questions.map(() => 0);
      const answers = new Map<number, Answer>();
      let currentTab = 0;
      let cachedLines: string[] | undefined;
      let focused = false;
      let settled = false;

      const abortHandler = () => finish({ answers: [], cancelled: true });
      signal?.addEventListener("abort", abortHandler, { once: true });

      function finish(result: QuestionnaireResult): void {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abortHandler);
        done(result);
      }

      function currentQuestion(): AskQuestion | undefined {
        return questions[currentTab];
      }

      function currentInput(): Input | undefined {
        if (currentTab >= questions.length) return undefined;
        return contextInputs[currentTab];
      }

      function syncFocus(): void {
        for (const input of contextInputs) input.focused = false;
        const input = currentInput();
        if (focused && input) input.focused = true;
      }

      function refresh(): void {
        cachedLines = undefined;
        syncFocus();
        tui.requestRender();
      }

      function allAnswered(): boolean {
        return questions.every((_question, index) => answers.has(index));
      }

      function saveCurrent(): boolean {
        if (currentTab >= questions.length) return true;

        const question = questions[currentTab];
        const selected = question.options[selectedIndexes[currentTab]];
        const typed = trimValue(contextInputs[currentTab].getValue(), MAX_ANSWER_LENGTH);
        if (selected === OTHER_OPTION) {
          if (!typed) {
            answers.delete(currentTab);
            return false;
          }
          answers.set(currentTab, {
            question: question.question,
            answer: typed,
            answerSource: "freeform",
          });
        } else {
          answers.set(currentTab, {
            question: question.question,
            answer: selected,
            answerSource: "option",
            ...(typed ? { context: typed.slice(0, MAX_CONTEXT_LENGTH) } : {}),
          });
        }
        return true;
      }

      function orderedAnswers(): Answer[] {
        return questions.flatMap((_question, index) => {
          const answer = answers.get(index);
          return answer ? [answer] : [];
        });
      }

      function goToTab(tab: number): void {
        saveCurrent();
        currentTab = Math.max(0, Math.min(questions.length, tab));
        refresh();
      }

      function selectOption(index: number): void {
        const question = currentQuestion();
        if (!question) return;
        selectedIndexes[currentTab] = Math.max(0, Math.min(question.options.length - 1, index));
        answers.delete(currentTab);
        refresh();
      }

      function commitCurrent(): void {
        if (currentTab === questions.length) {
          if (allAnswered()) finish({ answers: orderedAnswers(), cancelled: false });
          return;
        }

        if (saveCurrent()) {
          currentTab += 1;
          refresh();
        } else {
          refresh();
        }
      }

      function handleInput(data: string): void {
        if (matchesKey(data, Key.escape)) {
          finish({ answers: [], cancelled: true });
          return;
        }

        if (currentTab === questions.length) {
          if (matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) goToTab(questions.length - 1);
          else if (matchesKey(data, Key.right) || matchesKey(data, Key.tab)) goToTab(0);
          else if (matchesKey(data, Key.enter)) commitCurrent();
          return;
        }

        const question = currentQuestion();
        if (!question) return;

        if (matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) {
          goToTab(currentTab - 1);
          return;
        }
        if (matchesKey(data, Key.right)) {
          goToTab(currentTab + 1);
          return;
        }
        if (matchesKey(data, Key.tab)) {
          goToTab(currentTab + 1);
          return;
        }
        if (matchesKey(data, Key.up)) {
          selectOption(selectedIndexes[currentTab] - 1);
          return;
        }
        if (matchesKey(data, Key.down)) {
          selectOption(selectedIndexes[currentTab] + 1);
          return;
        }
        if (/^[1-9]$/.test(data) && !contextInputs[currentTab].getValue()) {
          const index = Number(data) - 1;
          if (index < question.options.length) {
            selectOption(index);
          }
          return;
        }
        if (matchesKey(data, Key.enter)) {
          commitCurrent();
          return;
        }

        answers.delete(currentTab);
        currentInput()?.handleInput(data);
        refresh();
      }

      function render(width: number): string[] {
        if (cachedLines) return cachedLines;
        const lines: string[] = [];
        const add = (line: string) => lines.push(truncateToWidth(line, width));
        add(theme.fg("accent", "─".repeat(width)));

        const tabs = questions.map((question, index) => {
          const active = index === currentTab;
          const answered = answers.has(index);
          const label = `${answered ? "✓" : "○"} ${index + 1}`;
          return active ? theme.bg("selectedBg", theme.fg("text", ` ${label} `)) : theme.fg(answered ? "success" : "muted", ` ${label} `);
        });
        const submitActive = currentTab === questions.length;
        tabs.push(submitActive ? theme.bg("selectedBg", theme.fg("text", " ✓ Submit ")) : theme.fg(allAnswered() ? "success" : "dim", " ✓ Submit "));
        add(` ${tabs.join(" ")}`);
        lines.push("");

        if (currentTab === questions.length) {
          add(theme.fg("accent", theme.bold("Submit answers")));
          lines.push("");
          for (const [index, answer] of answers) add(`${theme.fg("muted", ` ${index + 1}. `)}${theme.fg("text", answer.answer)}`);
          lines.push("");
          add(allAnswered() ? theme.fg("success", " Press Enter to submit") : theme.fg("warning", " Answer every question before submitting"));
        } else {
          const question = questions[currentTab];
          add(theme.fg("text", `Question ${currentTab + 1} of ${questions.length}`));
          add(theme.fg("text", ` ${question.question}`));
          lines.push("");
          question.options.forEach((option, index) => {
            const selected = index === selectedIndexes[currentTab];
            const prefix = selected ? theme.fg("accent", "> ") : "  ";
            const label = `${index + 1}. ${option}`;
            add(`${prefix}${theme.fg(selected ? "accent" : "text", label)}`);
          });
          lines.push("");
          add(theme.fg("muted", "Type to add context"));
          for (const line of contextInputs[currentTab].render(Math.max(1, width - 2))) add(` ${line}`);
        }

        lines.push("");
        add(theme.fg("dim", "←→ questions · ↑↓ choices · 1–9 select · Enter continue · Tab next question · Esc cancel"));
        add(theme.fg("accent", "─".repeat(width)));
        cachedLines = lines;
        return lines;
      }

      return {
        get focused() { return focused; },
        set focused(value: boolean) { focused = value; syncFocus(); },
        render,
        invalidate: () => {
          cachedLines = undefined;
          for (const input of contextInputs) input.invalidate();
        },
        handleInput,
      };
    });
  } catch {
    return undefined;
  }
}

export default function askUser(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "ask_user",
    label: "Ask user",
    description: "Ask one to five focused multiple-choice questions in one keyboard-driven questionnaire. The user can type context at any point, navigate questions with arrows, and submit all answers together.",
    parameters: AskUserParameters,
    executionMode: "sequential",

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const questions = normalizeQuestions(params.questions);
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text" as const, text: "The user-question UI is not available in this mode." }],
          details: { questions, answers: [], cancelled: true },
        };
      }

      const customResult = await askWithCustomUi(ctx, questions, signal);
      const result = customResult ?? await askThroughRpc(ctx, questions, signal);
      return answerResult(questions, result);
    },
  });
}
