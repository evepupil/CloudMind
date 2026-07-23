export type QueueMessageConsumer<Body> = (body: Body) => Promise<void>;

// 每条消息单独确认结果，确保一个失败项不会让同批成功项重复执行。
export const consumeQueueBatch = async <Body>(
  batch: MessageBatch<Body>,
  consumeMessage: QueueMessageConsumer<Body>
): Promise<void> => {
  for (const message of batch.messages) {
    try {
      await consumeMessage(message.body);
      message.ack();
    } catch {
      message.retry();
    }
  }
};
