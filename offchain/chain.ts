export interface Point { id: string; slot: number }
export interface ChainOutput { address: string; value: Record<string, Record<string, number>>; datum?: string }
export interface ChainInput { transaction: { id: string }; index: number }
export interface ChainTransaction {
  id: string; inputs: ChainInput[]; outputs: ChainOutput[];
  spends?: 'inputs' | 'collaterals'; extraSignatories?: string[];
  mint?: Record<string, Record<string, number>>;
}
export interface Block extends Point { transactions?: ChainTransaction[] }
export class Rpc {
  private socket: WebSocket;
  private sequence = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', event => {
      try {
        const response = JSON.parse(String(event.data));
        const call = this.pending.get(response.id);
        if (!call) return;
        this.pending.delete(response.id); clearTimeout(call.timer);
        if (response.error) call.reject(new Error(JSON.stringify(response.error))); else call.resolve(response.result);
      } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
    socket.addEventListener('close', () => this.fail(new Error('Ogmios disconnected')));
    socket.addEventListener('error', () => this.fail(new Error('Ogmios connection failed')));
  }
  private fail(error: Error) {
    for (const call of this.pending.values()) { clearTimeout(call.timer); call.reject(error); }
    this.pending.clear();
  }
  static async connect(endpoint: string): Promise<Rpc> {
    const url = new URL(endpoint);
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Chain source must be an Ogmios WebSocket endpoint');
    const socket = new WebSocket(endpoint);
    const rpc = new Rpc(socket);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('Ogmios connect timeout')); }, 10_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Ogmios connection failed')); }, { once: true });
    });
    return rpc;
  }
  call(method: string, params?: unknown): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Ogmios ${method} timeout`)); }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }), id }));
    });
  }
  close() { this.socket.close(); this.fail(new Error('Chain reader closed')); }
}

// Each invocation creates a new origin cursor; neither index files nor submission logs are inputs.
export async function readChain(endpoint: string): Promise<Block[]> {
  const rpc = await Rpc.connect(endpoint);
  try {
    const intersection = await rpc.call('findIntersection', { points: ['origin'] });
    const tip: Point | 'origin' = intersection.tip;
    if (tip === 'origin') return [];
    const blocks: Block[] = [];
    const deadline = Date.now() + 120_000;
    // Bounded chain-sync pipelining keeps full-history reads practical as the devnet grows.
    // Rejections are values until consumed, so closing the snapshot cannot leak rejected promises.
    const next = () => rpc.call('nextBlock').catch(error => error instanceof Error ? error : new Error(String(error)));
    const queue = Array.from({ length: 16 }, next);
    while (Date.now() < deadline) {
      const response = await queue.shift()!;
      if (response instanceof Error) throw response;
      queue.push(next());
      if (response.direction === 'backward') {
        if (response.point === 'origin') blocks.length = 0;
        else {
          const index = blocks.findIndex(block => block.id === response.point.id);
          if (index < 0) throw new Error('Rollback point outside captured history');
          blocks.splice(index + 1);
        }
      } else if (response.direction === 'forward') {
        blocks.push(response.block);
        if (response.block.id === tip.id) return blocks;
      } else throw new Error('Unknown chain-sync direction');
    }
    throw new Error('Chain snapshot timeout; retry from origin');
  } finally { rpc.close(); }
}
export function transactions(blocks: Block[]): ChainTransaction[] {
  return blocks.flatMap(block => block.transactions ?? []).filter(tx => tx.spends !== 'collaterals');
}
