import { describe, expect, it } from "vitest";

import type { JobQueueMessage } from "@/core/queue/ports";
import {
  applyGraphAccessReinforcement,
  buildReinforceGraphAccessMessage,
  parseReinforceGraphAccessMessage,
  REINFORCE_GRAPH_ACCESS_TYPE,
} from "@/features/memory/server/reinforcement";

describe("buildReinforceGraphAccessMessage", () => {
  it("builds a typed message carrying the statement ids", () => {
    const message = buildReinforceGraphAccessMessage(["s1", "s2"]);

    expect(message.type).toBe(REINFORCE_GRAPH_ACCESS_TYPE);
    expect(JSON.parse(message.payloadJson)).toEqual({
      statementIds: ["s1", "s2"],
    });
  });

  it("round-trips through parse", () => {
    const message = buildReinforceGraphAccessMessage(["s1"]);

    expect(parseReinforceGraphAccessMessage(message)).toEqual({
      statementIds: ["s1"],
    });
  });
});

describe("parseReinforceGraphAccessMessage", () => {
  it("returns null for a different message type", () => {
    const message: JobQueueMessage = {
      type: "workflow_step",
      payloadJson: JSON.stringify({ statementIds: ["s1"] }),
    };

    expect(parseReinforceGraphAccessMessage(message)).toBeNull();
  });

  it("returns null for invalid json", () => {
    const message: JobQueueMessage = {
      type: REINFORCE_GRAPH_ACCESS_TYPE,
      payloadJson: "{not json",
    };

    expect(parseReinforceGraphAccessMessage(message)).toBeNull();
  });

  it("returns null when statementIds is empty", () => {
    const message: JobQueueMessage = {
      type: REINFORCE_GRAPH_ACCESS_TYPE,
      payloadJson: JSON.stringify({ statementIds: [] }),
    };

    expect(parseReinforceGraphAccessMessage(message)).toBeNull();
  });

  it("returns null when an id is not a string", () => {
    const message: JobQueueMessage = {
      type: REINFORCE_GRAPH_ACCESS_TYPE,
      payloadJson: JSON.stringify({ statementIds: [1, 2] }),
    };

    expect(parseReinforceGraphAccessMessage(message)).toBeNull();
  });
});

describe("applyGraphAccessReinforcement", () => {
  it("forwards the statement ids to bumpStatementAccess", async () => {
    const bumped: string[][] = [];

    await applyGraphAccessReinforcement(
      {
        async bumpStatementAccess(ids) {
          bumped.push(ids);
        },
      },
      { statementIds: ["s1", "s2"] }
    );

    expect(bumped).toEqual([["s1", "s2"]]);
  });
});
