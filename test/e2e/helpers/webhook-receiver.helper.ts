import { createServer, IncomingHttpHeaders, Server } from 'http';

export type ReceivedWebhook = {
  headers: IncomingHttpHeaders;
  body: string;
};

export type WebhookReceiver = {
  port: number;
  waitForDelivery: (timeoutMs?: number) => Promise<ReceivedWebhook>;
  close: () => Promise<void>;
};

export async function startWebhookReceiver(): Promise<WebhookReceiver> {
  const deliveries: ReceivedWebhook[] = [];
  const waiters: Array<(delivery: ReceivedWebhook) => void> = [];

  const server: Server = createServer((req, res) => {
    let raw = '';

    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
    });

    req.on('end', () => {
      const delivery: ReceivedWebhook = { headers: req.headers, body: raw };
      const waiter = waiters.shift();

      if (waiter) {
        waiter(delivery);
      } else {
        deliveries.push(delivery);
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });

  const waitForDelivery = (timeoutMs = 10_000): Promise<ReceivedWebhook> => {
    const existing = deliveries.shift();
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for webhook delivery after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      waiters.push((delivery) => {
        clearTimeout(timer);
        resolve(delivery);
      });
    });
  };

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

  return { port, waitForDelivery, close };
}
