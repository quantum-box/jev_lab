declare module 'cloudflare:workers' {
  interface DurableObjectTransaction {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
  }

  interface DurableObjectStorage {
    transaction<T>(callback: (transaction: DurableObjectTransaction) => Promise<T>): Promise<T>;
  }

  interface DurableObjectState {
    storage: DurableObjectStorage;
  }

  export class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}
