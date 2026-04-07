export class McpTokenNotFoundError extends Error {
  public constructor(id: string) {
    super(`MCP token "${id}" not found.`);
    this.name = "McpTokenNotFoundError";
  }
}
