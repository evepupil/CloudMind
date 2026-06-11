import { describe, expect, it, vi } from "vitest";

import {
  extractGeneratedText,
  stripReasoningBlocks,
  WorkersAIProvider,
} from "@/platform/ai/workers-ai/workers-ai-provider";

describe("extractGeneratedText", () => {
  it("returns the raw string output as-is", () => {
    expect(extractGeneratedText("plain string output")).toBe(
      "plain string output"
    );
  });

  it("returns the response field when Workers AI returns response text", () => {
    expect(
      extractGeneratedText({
        response: "response field output",
      })
    ).toBe("response field output");
  });

  it("returns choices[0].message.content when the model returns chat completion format", () => {
    expect(
      extractGeneratedText({
        choices: [
          {
            message: {
              content: "message content output",
            },
          },
        ],
      })
    ).toBe("message content output");
  });

  it("returns choices[0].text when the model returns text completion format", () => {
    expect(
      extractGeneratedText({
        choices: [
          {
            text: "choice text output",
          },
        ],
      })
    ).toBe("choice text output");
  });

  it("returns an empty string for unsupported output shapes", () => {
    expect(extractGeneratedText({ foo: "bar" })).toBe("");
    expect(extractGeneratedText(null)).toBe("");
  });
});

describe("stripReasoningBlocks", () => {
  it("removes <think> reasoning blocks and trims", () => {
    expect(
      stripReasoningBlocks("<think>let me reason</think>\n\nClean answer.")
    ).toBe("Clean answer.");
  });

  it("leaves text without think blocks unchanged (trimmed)", () => {
    expect(stripReasoningBlocks("  plain answer  ")).toBe("plain answer");
  });

  it("strips an unclosed <think> block (truncated mid-reasoning) to empty", () => {
    expect(
      stripReasoningBlocks("<think>truncated reasoning with no closing tag")
    ).toBe("");
  });

  it("strips a trailing unclosed <think> but keeps preceding clean text", () => {
    expect(
      stripReasoningBlocks("Clean answer.\n<think>trailing reasoning")
    ).toBe("Clean answer.");
  });
});

describe("WorkersAIProvider.generateText", () => {
  it("sends system + user chat messages (not raw completion)", async () => {
    const runMock = vi.fn(async () => ({
      choices: [
        {
          message: {
            content: "grounded answer [S1]",
          },
        },
      ],
    }));
    const provider = new WorkersAIProvider({
      run: runMock,
    } as unknown as Ai);

    const result = await provider.generateText({
      prompt: "Question prompt",
      systemPrompt: "System prompt",
      temperature: 0.2,
      maxOutputTokens: 300,
    });

    expect(runMock).toHaveBeenCalledWith("@cf/qwen/qwen3-30b-a3b-fp8", {
      messages: [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Question prompt" },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });
    expect(result).toEqual({
      text: "grounded answer [S1]",
      provider: "workers_ai",
      model: "@cf/qwen/qwen3-30b-a3b-fp8",
    });
  });

  it("omits the system message when no systemPrompt is provided", async () => {
    const runMock = vi.fn(async () => ({ response: "ok" }));
    const provider = new WorkersAIProvider({
      run: runMock,
    } as unknown as Ai);

    await provider.generateText({ prompt: "just user" });

    expect(runMock).toHaveBeenCalledWith("@cf/qwen/qwen3-30b-a3b-fp8", {
      messages: [{ role: "user", content: "just user" }],
    });
  });

  it("strips qwen3 <think> reasoning blocks from the generated text", async () => {
    const runMock = vi.fn(async () => ({
      response: "<think>reasoning here</think>Clean summary text.",
    }));
    const provider = new WorkersAIProvider({
      run: runMock,
    } as unknown as Ai);

    const result = await provider.generateText({ prompt: "summarize" });

    expect(result.text).toBe("Clean summary text.");
  });
});

describe("WorkersAIProvider.createEmbeddings", () => {
  it("prepends a query instruction to query texts (asymmetric retrieval)", async () => {
    const runMock = vi.fn(async (_model: string, _input: unknown) => ({
      data: [[0.1, 0.2]],
      shape: [1, 2],
    }));
    const provider = new WorkersAIProvider({ run: runMock } as unknown as Ai);

    await provider.createEmbeddings({
      texts: ["hybrid search"],
      purpose: "query",
    });

    const call = runMock.mock.calls[0];
    expect(call?.[0]).toBe("@cf/baai/bge-m3");
    const args = call?.[1] as { text: string[] } | undefined;
    expect(args?.text[0]).not.toBe("hybrid search");
    expect(args?.text[0]?.endsWith("hybrid search")).toBe(true);
  });

  it("leaves document texts unprefixed so existing passage vectors stay valid", async () => {
    const runMock = vi.fn(async (_model: string, _input: unknown) => ({
      data: [[0.1, 0.2]],
      shape: [1, 2],
    }));
    const provider = new WorkersAIProvider({ run: runMock } as unknown as Ai);

    await provider.createEmbeddings({
      texts: ["a stored passage"],
      purpose: "document",
    });

    const args = runMock.mock.calls[0]?.[1] as { text: string[] } | undefined;
    expect(args?.text).toEqual(["a stored passage"]);
  });

  it("returns empty without calling the model for empty input", async () => {
    const runMock = vi.fn();
    const provider = new WorkersAIProvider({ run: runMock } as unknown as Ai);

    const result = await provider.createEmbeddings({ texts: [] });

    expect(result.embeddings).toEqual([]);
    expect(runMock).not.toHaveBeenCalled();
  });
});
