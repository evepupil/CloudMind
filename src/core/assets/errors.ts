// 这里放资产领域错误，避免页面层和基础设施层都依赖 feature 内部文件。
export class AssetNotFoundError extends Error {
  public constructor(id: string) {
    super(`Asset "${id}" was not found.`);
    this.name = "AssetNotFoundError";
  }
}
