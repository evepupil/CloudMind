import type { AssetSearchRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import {
  applyContextPolicyScore,
  matchesContextPolicyAsset,
} from "@/features/search/server/context-policy";
import {
  annotateEvidenceMatchReasons,
  buildChunkEvidenceItem,
  buildSummaryEvidenceItem,
} from "@/features/search/server/evidence";
import { scoreAssetSummaryMatch } from "@/features/search/server/summary-scoring";
import {
  CHAT_SUMMARY_ONLY_AI_VISIBILITY,
  type GroundingContext,
  SOURCE_TYPE_PRIORITY,
} from "./grounding";

const isProfileBoosted = (
  context: GroundingContext,
  contextPolicy: ContextRetrievalPolicy | undefined
): boolean => {
  return Boolean(contextPolicy?.boostedDomains.includes(context.asset.domain));
};

export const getSummaryGroundingContexts = async (
  repository: AssetSearchRepository,
  question: string,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
): Promise<GroundingContext[]> => {
  if (contextPolicy && !contextPolicy.includeSummaryOnly) {
    return [];
  }

  const summaryMatches = await repository
    .searchAssetSummaries({
      query: question,
      limit,
      aiVisibility: [...CHAT_SUMMARY_ONLY_AI_VISIBILITY],
    })
    .catch(() => []);

  return buildSummaryGroundingContexts(question, summaryMatches)
    .map((context) => ({
      ...context,
      score: applyContextPolicyScore(
        context.score,
        context.asset,
        contextPolicy
      ),
    }))
    .map((context) =>
      annotateEvidenceMatchReasons(context, {
        profileBoosted: isProfileBoosted(context, contextPolicy),
      })
    )
    .filter((context) =>
      matchesContextPolicyAsset(context.asset, contextPolicy)
    );
};

export const buildGroundingContexts = (
  vectorMatches: Awaited<ReturnType<VectorStore["search"]>>,
  chunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  >
): GroundingContext[] => {
  const chunkMatchMap = new Map(
    chunkMatches
      .filter((match) => match.vectorId)
      .map((match) => [match.vectorId as string, match])
  );

  return vectorMatches.reduce<GroundingContext[]>((contexts, match) => {
    const chunkMatch = chunkMatchMap.get(match.id);

    if (!chunkMatch) {
      return contexts;
    }

    contexts.push(buildChunkEvidenceItem(chunkMatch, match.score));

    return contexts;
  }, []);
};

export const buildSummaryGroundingContexts = (
  question: string,
  summaryMatches: Awaited<
    ReturnType<AssetSearchRepository["searchAssetSummaries"]>
  >
): GroundingContext[] => {
  return summaryMatches
    .map((match) =>
      buildSummaryEvidenceItem(match, scoreAssetSummaryMatch(question, match))
    )
    .sort((left, right) => right.score - left.score);
};

export const compareGroundingContexts = (
  question: string,
  left: GroundingContext,
  right: GroundingContext,
  getContextSelectionScore: (
    question: string,
    context: GroundingContext
  ) => number
): number => {
  const rightSelectionScore = getContextSelectionScore(question, right);
  const leftSelectionScore = getContextSelectionScore(question, left);

  if (rightSelectionScore !== leftSelectionScore) {
    return rightSelectionScore - leftSelectionScore;
  }

  return SOURCE_TYPE_PRIORITY[right.layer] - SOURCE_TYPE_PRIORITY[left.layer];
};
