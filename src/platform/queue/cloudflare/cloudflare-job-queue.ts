import type { JobQueue, JobQueueMessage } from "@/core/queue/ports";

// 这里封装 Cloudflare Queue producer，避免业务层直接依赖 send 细节。
export class CloudflareJobQueue implements JobQueue {
  public constructor(private readonly queue: Queue<JobQueueMessage>) {}

  public async enqueue(message: JobQueueMessage): Promise<void> {
    await this.queue.send(message);
  }
}
