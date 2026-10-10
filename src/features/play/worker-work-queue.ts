/** One retained worker engine processes one job at a time. Failure never poisons
 * subsequent jobs; canceled queued work never allocates its heavy buffers. */
export function createWorkerWorkQueue() {
 let tail:Promise<void>=Promise.resolve();
 return function enqueue<T>(run:()=>Promise<T>,canceled:()=>boolean=()=>false):Promise<T|undefined>{
  const task=tail.then(()=>canceled()?undefined:run());
  tail=task.then(()=>undefined,()=>undefined);
  return task;
 };
}
