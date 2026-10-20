import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection, type ILogger } from '@microsoft/signalr';

import { tokenStore } from '@/core/session/tokenStore';

/** Hub event name → handler of its payload (`{}` when the server sends none). */
export type HubEvents = Record<string, (payload: unknown) => void>;

/** SignalR logs through console by default; route only real errors to the dev console. */
const quietLogger: ILogger = {
  log(level, message) {
    if (__DEV__ && level >= LogLevel.Critical) console.warn(`[signalr] ${message}`);
  },
};

const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000];

/** One SignalR connection to a back-end's hub, with token refresh and backoff. */
export class ServiceHub {
  private connection: HubConnection | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = true;

  /** `ping`: any authenticated call of that back-end, made when connecting fails so an expired token gets refreshed. */
  constructor(
    private readonly url: string,
    private readonly events: HubEvents,
    private readonly ping: () => Promise<unknown>,
  ) {}

  start() {
    this.stopped = false;
    void this.connect();
  }

  async stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const connection = this.connection;
    this.connection = null;
    if (connection) await connection.stop().catch(() => undefined);
  }

  private build() {
    const connection = new HubConnectionBuilder()
      .withUrl(this.url, {
        // Read lazily so reconnects pick up refreshed tokens.
        accessTokenFactory: () => tokenStore.get()?.token ?? '',
      })
      .withAutomaticReconnect(RETRY_DELAYS)
      .configureLogging(quietLogger)
      .build();

    for (const [name, handler] of Object.entries(this.events)) connection.on(name, (payload: unknown) => handler(payload ?? {}));
    connection.onclose(() => {
      if (!this.stopped) this.scheduleRetry();
    });
    return connection;
  }

  private async connect() {
    if (this.stopped || !tokenStore.get()) return;
    if (this.connection?.state === HubConnectionState.Connected) return;
    this.connection = this.connection ?? this.build();
    try {
      await this.connection.start();
      this.attempts = 0;
    } catch {
      // Expired token: any authenticated REST call refreshes it; the next attempt uses the new one.
      void this.ping().catch(() => undefined);
      this.scheduleRetry();
    }
  }

  private scheduleRetry() {
    if (this.stopped || this.retryTimer) return;
    const delay = RETRY_DELAYS[Math.min(this.attempts, RETRY_DELAYS.length - 1)];
    this.attempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.connection?.state === HubConnectionState.Disconnected) this.connection = null;
      void this.connect();
    }, delay);
  }
}
