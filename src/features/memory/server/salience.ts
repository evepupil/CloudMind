// L2 显著性加权与强化合成。对标 Zep 的
//   relevance × exp(-λ·age) × importance × log(1+access)
// 但做稳健化处理：importance/access 取「1+」乘子，避免冷启动（importance=0 或 access=0）把分数归零。

export interface SalienceInputs {
  // 录入时间（statement.created_at）；用于 recency 衰减。空/不可解析则不衰减。
  createdAt: string | null;
  // 事实重要度 [0,1]（当前写入恒为 0，留待调和/置信度填充）。
  importance: number;
  // 被检索命中累计次数（强化信号）。
  accessCount: number;
}

export interface SalienceWeightOptions {
  // 便于测试注入「现在」；默认取系统时钟。
  nowMs?: number | undefined;
  // recency 半衰期（天）。事实衰减比新闻慢，默认 180 天。
  halfLifeDays?: number | undefined;
  // access 强化强度系数。
  accessAlpha?: number | undefined;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// 对一个基础相关度分数施加显著性加权：
//   recency        = 0.5^(ageDays / halfLife)         事实越旧权重越低（半衰期长 → 衰减温和）
//   importanceBoost = 1 + importance                   importance=0 时中性
//   accessBoost     = 1 + accessAlpha·ln(1 + access)   access=0 时中性
// finalScore = base × recency × importanceBoost × accessBoost
export const applySalienceWeight = (
  baseScore: number,
  inputs: SalienceInputs,
  options?: SalienceWeightOptions
): number => {
  const nowMs = options?.nowMs ?? Date.now();
  const halfLifeDays = options?.halfLifeDays ?? 180;
  const accessAlpha = options?.accessAlpha ?? 0.5;

  let recency = 1;

  if (inputs.createdAt) {
    const createdMs = Date.parse(inputs.createdAt);

    if (!Number.isNaN(createdMs)) {
      const ageDays = Math.max(0, (nowMs - createdMs) / MS_PER_DAY);
      recency = 0.5 ** (ageDays / halfLifeDays);
    }
  }

  const importanceBoost = 1 + Math.max(0, inputs.importance);
  const accessBoost =
    1 + accessAlpha * Math.log1p(Math.max(0, inputs.accessCount));

  return baseScore * recency * importanceBoost * accessBoost;
};

// 由强化信号合成显著性分（0..1 软上界，饱和）：被提及/被访问越多越显著。
// 供 sleep-time 批量回写 entities.salience 与遗忘判定使用。
export const computeSalience = (inputs: {
  mentionCount: number;
  accessCount: number;
}): number => {
  const signal =
    0.3 * Math.max(0, inputs.mentionCount) +
    0.7 * Math.max(0, inputs.accessCount);

  return 1 - 1 / (1 + signal);
};
