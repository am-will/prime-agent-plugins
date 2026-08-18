import assert from "node:assert/strict";
import test from "node:test";

import askUser, {
  ASK_USER_RPC_MARKER,
  OTHER_OPTION,
} from "../plugins/ask-user/extensions/ask-user.ts";

function registeredTool() {
  let tool;
  askUser({
    registerTool(value) {
      tool = value;
    },
  });
  assert.ok(tool);
  return tool;
}

async function execute(tool, questions, ui) {
  return tool.execute(
    "test-call",
    { questions },
    undefined,
    undefined,
    { hasUI: true, ui },
  );
}

test("select-only clients receive only visible answer options", async () => {
  const tool = registeredTool();
  const shown = [];
  const questions = [
    { question: "First?", options: ["Alpha", "Beta"] },
    { question: "Second?", options: ["Gamma", "Delta"] },
  ];
  const ui = {
    async select(_question, options) {
      shown.push(options);
      return options[0];
    },
  };

  const result = await execute(tool, questions, ui);

  assert.deepEqual(shown, [
    ["Alpha", "Beta", OTHER_OPTION],
    ["Gamma", "Delta", OTHER_OPTION],
  ]);
  assert.equal(
    shown.flat().some((option) => option.startsWith(ASK_USER_RPC_MARKER)),
    false,
  );
  assert.deepEqual(
    result.details.answers.map(({ answer, answerSource }) => ({ answer, answerSource })),
    [
      { answer: "Alpha", answerSource: "option" },
      { answer: "Gamma", answerSource: "option" },
    ],
  );
});

test("RPC clients receive plain options and retain encoded answers", async () => {
  const tool = registeredTool();
  const shown = [];
  const questions = [
    { question: "First?", options: ["Alpha", "Beta"] },
    { question: "Second?", options: ["Gamma", "Delta"] },
  ];
  const rpcAnswers = [
    JSON.stringify({ answer: "Beta", answerSource: "option", context: "Because" }),
    JSON.stringify({ answer: "Typed answer", answerSource: "freeform" }),
  ];
  const ui = {
    async custom() {
      return undefined;
    },
    async select(_question, options) {
      const index = shown.length;
      shown.push(options);
      return rpcAnswers[index];
    },
  };

  const result = await execute(tool, questions, ui);

  assert.deepEqual(shown, [
    ["Alpha", "Beta", OTHER_OPTION],
    ["Gamma", "Delta", OTHER_OPTION],
  ]);
  assert.equal(
    shown.flat().some((option) => option.startsWith(ASK_USER_RPC_MARKER)),
    false,
  );
  assert.deepEqual(result.details.answers, [
    {
      question: "First?",
      answer: "Beta",
      answerSource: "option",
      context: "Because",
    },
    {
      question: "Second?",
      answer: "Typed answer",
      answerSource: "freeform",
    },
  ]);
});

test("cancelling a select-only questionnaire returns no partial answers", async () => {
  const tool = registeredTool();
  let call = 0;
  const ui = {
    async select(_question, options) {
      call += 1;
      return call === 1 ? options[0] : undefined;
    },
  };

  const result = await execute(tool, [
    { question: "First?", options: ["Alpha", "Beta"] },
    { question: "Second?", options: ["Gamma", "Delta"] },
  ], ui);

  assert.equal(result.details.cancelled, true);
  assert.deepEqual(result.details.answers, []);
});

function customUiHarness() {
  let component;
  let resolveCustom;
  let renderRequests = 0;
  const completion = new Promise((resolve) => {
    resolveCustom = resolve;
  });
  const theme = {
    fg(_color, text) { return text; },
    bg(_color, text) { return text; },
    bold(text) { return text; },
  };
  const ui = {
    custom(factory) {
      component = factory(
        { requestRender() { renderRequests += 1; } },
        theme,
        {},
        resolveCustom,
      );
      component.focused = true;
      return completion;
    },
  };

  return {
    ui,
    get component() {
      assert.ok(component);
      return component;
    },
    get renderRequests() { return renderRequests; },
  };
}

test("custom questionnaire wraps long question text to the available width", async () => {
  const tool = registeredTool();
  const harness = customUiHarness();
  const pending = execute(tool, [{
    question: "This question is long enough that it must wrap across multiple terminal lines",
    options: ["Alpha", "Beta"],
  }], harness.ui);

  await Promise.resolve();
  const lines = harness.component.render(24);
  const questionLines = lines.filter(
    (line) => line.includes("This question") || line.includes("long enough") || line.includes("terminal lines"),
  );

  assert.ok(questionLines.length > 1);
  harness.component.handleInput("\x1b");
  await pending;
});

test("custom questionnaire ignores an initial terminal focus-out event", async () => {
  const tool = registeredTool();
  const harness = customUiHarness();
  const pending = execute(tool, [{
    question: "Choose one",
    options: ["Alpha", "Beta"],
  }], harness.ui);

  await Promise.resolve();
  const renderRequestsBefore = harness.renderRequests;
  harness.component.handleInput("\x1b[O");

  assert.equal(harness.renderRequests, renderRequestsBefore);
  harness.component.handleInput("\r");
  harness.component.handleInput("\r");
  const result = await pending;
  assert.equal(result.details.cancelled, false);
  assert.equal(result.details.answers[0].answer, "Alpha");
});
