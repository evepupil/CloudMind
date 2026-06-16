// 记忆 scope（归属维度）：personal=用户显式让 AI 记的人记忆（纯净、有用户背书）；
// agent=AI 自动沉淀的 agent 记忆（默认不进日常检索，需专用接口显式读）。
// scope 是隔离维度（决定记忆归谁、检索默认只看 personal），不是普通检索 facet——
// 切勿当成 domain/type 那样的过滤切面随意放开。
// 注意：scope_id 在 D1 是自由 text 列，这里的联合类型只做 TS 层约束，DB 不强制。

export const PERSONAL_SCOPE = "personal";
export const AGENT_SCOPE = "agent";

export type MemoryScope = typeof PERSONAL_SCOPE | typeof AGENT_SCOPE;

// 写入/检索未显式指定 scope 时的默认值（= 人记忆）。
export const DEFAULT_SCOPE: MemoryScope = PERSONAL_SCOPE;
