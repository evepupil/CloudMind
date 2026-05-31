# M1 设计 Spec：消除重复代码 + 修静默错误

## 概述

本轮（M1）在不改变任何产品行为的前提下：
1. 消除 3 个工作流文件间的重复步骤定义
2. 修复 5 处静默吞掉错误的 `catch {}`
3. 修复 1 处 Biome lint 警告

完成后必须通过 `pnpm typecheck && pnpm lint && pnpm test`。

---

## 1. 工作流去重

### 1.1 重复分析

3 个文件 `{note,url,pdf}-ingest-workflow.ts` 共 ~1660 行。对每个步骤做 diff 比对：

| 步骤 | note | url | pdf | 策略 |
|------|------|-----|-----|------|
| `clean_content` | `asset.contentText` 来源 | `state.extractedContent` 来源 | 同 url | 参数化来源提取 |
| `summarize` | 有 enrichment + title 生成 | 纯摘要 | 同 url | 参数化 enrichment + title |
| `derive_descriptor` | 无 auto-enrichment | 有 `generateWorkflowDescriptorEnrichment` | 同 url | 参数化 enrichment factory |
| `derive_facets` | 有 enrichment facets | 无 | 同 url | 参数化 enrichment |
| `derive_access_policy` | **完全一致** | **完全一致** | **完全一致** | 提取为共享函数 |
| `derive_assertions` | **完全一致** | **完全一致** | **完全一致** | 提取为共享函数 |
| `persist_content` | 无额外 metadata | 加 sourceUrl/fetchedAt | 加 totalPages | 参数化 extra metadata |
| `chunk` | **完全一致** | **完全一致** | **完全一致** | 提取为共享函数 |
| `embed` | **完全一致** | **完全一致** | **完全一致** | 提取为共享函数 |
| `index` | **完全一致** | **完全一致** | **完全一致** | 提取为共享函数 |
| `finalize` | 无 rawR2Key | 加 rawR2Key + refinedTitle | 加 rawR2Key | 参数化额外操作 |

### 1.2 设计方案

#### 新建文件：`src/features/workflows/server/shared-workflow-steps.ts`

暴露 11 个步骤工厂函数，每个返回 `WorkflowStepDefinition`。

对于**完全一致**的步骤（5 个），函数无需参数：
- `createDeriveAccessPolicyStep()`
- `createDeriveAssertionsStep()`
- `createChunkStep()`
- `createEmbedStep()`
- `createIndexStep()`

对于**参数化**的步骤（6 个），接受配置回调：

```ts
// 示例签名
createCleanContentStep(options: {
  getContent: (asset: AssetDetail, state: Record<string, unknown>) => string;
})

createSummarizeStep(options?: {
  getEnrichment?: (state: Record<string, unknown>) => TextAssetEnrichmentInput | null;
  generateTitle?: boolean;  // 是否在摘要后生成标题
})

createDeriveDescriptorStep(options?: {
  createEnrichment?: (ctx: WorkflowExecutionContext) => Promise<TextAssetEnrichmentInput | null | undefined>;
})

createDeriveFacetsStep(options?: {
  getEnrichment?: (state: Record<string, unknown>) => TextAssetEnrichmentInput | null;
})

createPersistContentStep(options?: {
  buildMetadata?: (state: Record<string, unknown>) => Record<string, unknown>;
})

createFinalizeStep(options?: {
  getRawR2Key?: (state: Record<string, unknown>) => string | null;
  afterFinalize?: (ctx: WorkflowExecutionContext) => Promise<void>;
})
```

#### 改造 3 个 workflow 文件

每个文件变为：

```ts
// note-ingest-workflow.ts（约 100 行）
export const createNoteIngestWorkflowDefinition = (): WorkflowDefinition => ({
  type: "note_ingest_v1",
  steps: [
    // load_source：note 无此步骤
    createCleanContentStep({ getContent: (asset) => {
      if (!asset.contentText?.trim()) throw new Error("...");
      return normalizeContent(asset.contentText.trim());
    }}),
    createSummarizeStep({
      getEnrichment: getTextAssetEnrichment,
      generateTitle: true,
    }),
    createDeriveDescriptorStep({ createEnrichment: undefined }),
    createDeriveAccessPolicyStep(),
    createDeriveFacetsStep({ getEnrichment: getTextAssetEnrichment }),
    createDeriveAssertionsStep(),
    createPersistContentStep(),
    createChunkStep(),
    createEmbedStep(),
    createIndexStep(),
    createFinalizeStep(),
  ],
});

// url-ingest-workflow.ts（约 200 行，保留 load_source）
// pdf-ingest-workflow.ts（约 170 行，保留 load_source + decodePdfSignature）
```

#### 影响范围

- 新增：`src/features/workflows/server/shared-workflow-steps.ts`（~400 行）
- 修改：`note-ingest-workflow.ts`（521 → ~100 行）
- 修改：`url-ingest-workflow.ts`（590 → ~200 行）
- 修改：`pdf-ingest-workflow.ts`（549 → ~170 行）
- 不改：`registry.ts`（import 路径不变，因为 3 个文件的导出函数名不变）

净减少约 1200 行代码。

### 1.3 风险控制

- 所有共享步骤是纯函数重构，不改变执行逻辑
- 现有 19 个测试文件中 `processor.test.ts` 和 `content-processing.test.ts` 覆盖了相关逻辑
- 工作流未直接测试（因为依赖 D1/Queue/Vectorize），但步骤内调用的函数（`normalizeContent`、`generateAssetSummary`、`createChunkEmbeddings` 等）已被测试覆盖

---

## 2. 修复静默 catch{}

### 2.1 `note-ingest-workflow.ts:112`

```ts
// 旧
} catch {}

// 新
} catch (error) {
  workflowLogger.warn("Failed to generate asset title", {
    assetId: context.asset.id,
    error: String(error),
  });
}
```

需要在该文件内引入 `createLogger`。

### 2.2 `runtime.ts:85`（`parseStateJson`）

```ts
// 旧
} catch {}

// 新
} catch (error) {
  workflowLogger.warn("Failed to parse workflow state JSON", {
    error: String(error),
  });
}
```

### 2.3 `runtime.ts:443`（`parseQueuePayload`）

```ts
// 旧  
} catch {}

// 新
} catch (error) {
  workflowLogger.warn("Failed to parse queue payload", {
    error: String(error),
  });
}
```

### 2.4 `asset-workflows-page.tsx:69`

```ts
// 旧
} catch {}

// 新
} catch {
  // value is not valid JSON, keep as raw string
}
```

该 catch 用于 JSON 美化显示，失败时保持原始字符串。业务上不是错误，加注释说明意图即可。

### 2.5 `ingest/server/service.ts:430`

```ts
// 旧  
} catch {}

// 新
} catch (error) {
  ingestLogger.warn("Fallback AI enrichment also failed", {
    assetTitle: input.title,
    error: String(error),
  });
}
```

需要在该文件内引入 `createLogger`（如果还没有的话）。

---

## 3. Biome lint 警告修复

### 3.1 `search/server/service.ts:272`

```ts
// 旧
if (!chunk || !chunk.vectorId) {

// 新
if (!chunk?.vectorId) {
```

等价语义：`chunk` 为 falsy 或 `chunk.vectorId` 为 falsy 时返回 null。

---

## 验收标准

```bash
pnpm typecheck   # 零错误
pnpm lint        # 零警告
pnpm test        # 全绿
```

## 不纳入

- Zod 校验替代 as 断言（属 M3）
- 拆分大文件（属 M2）
- 补测试（属 M4）
