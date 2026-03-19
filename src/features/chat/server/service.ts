import type { AIProvider } from "@/core/ai/ports";
import type { AssetQueryRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";

import type { AskLibraryInput, AskLibraryResult } from "../model/types";

interface ChatServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetQueryRepository | Promise<AssetQueryRepository>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getAiProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
}

// 这里先定义聊天用例边界，等向量检索和 AI 适配器落地后再接入真实实现。
export const createChatService = (_dependencies: ChatServiceDependencies) => {
  return {
    async askLibrary(
      _bindings: AppBindings | undefined,
      _input: AskLibraryInput
    ): Promise<AskLibraryResult> {
      throw new Error(
        "Chat workflow is not configured yet. Add vector and AI adapters first."
      );
    },
  };
};
