export interface ScheduledTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void> | void;
  runOnStart?: boolean;
  startDelayMs?: number;
}

async function executeTask(task: ScheduledTask) {
  try {
    await task.run();
  } catch (error) {
    console.error(`[Scheduler] Task failed: ${task.name}`, error);
  }
}

export function registerScheduledTask(task: ScheduledTask) {
  if (task.runOnStart) {
    setTimeout(() => {
      void executeTask(task);
    }, task.startDelayMs ?? 0);
  }

  return setInterval(() => {
    void executeTask(task);
  }, task.intervalMs);
}
