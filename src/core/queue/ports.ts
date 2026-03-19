export interface JobQueueMessage {
  type: string;
  payloadJson: string;
  dedupeKey?: string | undefined;
}

// 这里保留统一队列端口，避免业务层直接依赖 Cloudflare Queues。
export interface JobQueue {
  enqueue(message: JobQueueMessage): Promise<void>;
}
