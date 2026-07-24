# Changelog

CloudMind 的重要变化记录在本文件中。版本号遵循 Semantic Versioning；0.x 阶段的
minor 版本允许调整尚未稳定的 API，patch 版本只包含兼容修复。

## [Unreleased]

## [0.3.0] - 2026-07-24

### Added

- 完整的 L1/L2/L3 私有记忆架构、混合检索、知识图谱和记忆生命周期。
- `recordKind × scopeId × contextKey` 三维隔离、Agent Web 管理和客户端记忆 Skill。
- 不可变原始快照、版本化整库导出、fresh-resource 恢复和可审计硬删除。
- 统一质量门禁、远端 migration 核验、生产冒烟、自动失败回滚和回滚演练工具。

### Changed

- 当前产品路线收敛到稳定发布；高级评价、聚合和手动关系操作转入历史归档。

### Removed

- episode 核心模型、自动保存完整外部会话和 `capture_episode` 入口。
