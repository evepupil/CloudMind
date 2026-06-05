import { describe, expect, it, vi } from "vitest";

import {
  extractGeneratedText,
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

describe("WorkersAIProvider.generateText", () => {
  it("uses the normalized text extraction logic for model output", async () => {
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
      prompt: "System prompt\n\nQuestion prompt",
      temperature: 0.2,
      max_tokens: 300,
    });
    expect(result).toEqual({
      text: "grounded answer [S1]",
      provider: "workers_ai",
      model: "@cf/qwen/qwen3-30b-a3b-fp8",
    });
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
