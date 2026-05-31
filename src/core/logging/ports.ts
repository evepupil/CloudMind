export type LogFields = Record<string, unknown>;

export interface LogOptions {
  error?: unknown;
}

// 这里定义核心日志端口，feature 层只依赖日志能力，不绑定具体平台输出实现。
export interface Logger {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields, options?: LogOptions) => void;
  error: (event: string, fields?: LogFields, options?: LogOptions) => void;
}
