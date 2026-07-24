export const mapWithConcurrency = async <Input, Output>(
  items: readonly Input[],
  concurrency: number,
  mapItem: (item: Input, index: number) => Promise<Output>
): Promise<Output[]> => {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];

      if (item === undefined) {
        throw new Error("Concurrent export index is out of bounds.");
      }

      results[index] = await mapItem(item, index);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
};
