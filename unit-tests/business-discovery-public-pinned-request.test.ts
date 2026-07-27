import test from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import { performPinnedRequest, PinnedRequestTimeoutError } from "../lib/business-discovery/public/pinnedRequest.ts";

/**
 * These tests spin up a real local HTTP server on 127.0.0.1 (no external
 * network, no live website) so pinning can be verified against an actual
 * socket connection rather than only a mocked call — the strongest possible
 * proof that the connection target and the Host header really are
 * independent of each other.
 */

async function withLocalServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  run: (port: number) => Promise<void>
) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    await run(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("connects to the pinned IP while sending the original hostname as the Host header", async () => {
  let observedHost: string | undefined;
  await withLocalServer(
    (req, res) => {
      observedHost = req.headers.host;
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hello from pinned server");
    },
    async (port) => {
      const response = await performPinnedRequest({
        protocol: "http:",
        hostname: "totally-different-hostname.example",
        pinnedAddress: "127.0.0.1",
        port,
        path: "/",
        headers: {},
        timeoutMs: 2000,
      });
      assert.equal(response.statusCode, 200);
      const chunks: Buffer[] = [];
      for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(chunks).toString("utf8"), "hello from pinned server");
    }
  );
  assert.equal(observedHost, "totally-different-hostname.example");
});

test("forwards custom headers alongside the overridden Host header", async () => {
  let observedAccept: string | undefined;
  await withLocalServer(
    (req, res) => {
      observedAccept = req.headers.accept;
      res.writeHead(200);
      res.end("ok");
    },
    async (port) => {
      await performPinnedRequest({
        protocol: "http:",
        hostname: "example.com",
        pinnedAddress: "127.0.0.1",
        port,
        path: "/",
        headers: { Accept: "text/html,application/xhtml+xml" },
        timeoutMs: 2000,
      });
    }
  );
  assert.equal(observedAccept, "text/html,application/xhtml+xml");
});

test("propagates the server's status code and response headers", async () => {
  await withLocalServer(
    (_req, res) => {
      res.writeHead(302, { location: "https://example.com/next" });
      res.end();
    },
    async (port) => {
      const response = await performPinnedRequest({
        protocol: "http:",
        hostname: "example.com",
        pinnedAddress: "127.0.0.1",
        port,
        path: "/",
        headers: {},
        timeoutMs: 2000,
      });
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, "https://example.com/next");
    }
  );
});

test("times out and throws PinnedRequestTimeoutError against a server that never responds", async () => {
  await withLocalServer(
    () => {
      // Never call res.end() — simulates a hung upstream.
    },
    async (port) => {
      await assert.rejects(
        () =>
          performPinnedRequest({
            protocol: "http:",
            hostname: "example.com",
            pinnedAddress: "127.0.0.1",
            port,
            path: "/",
            headers: {},
            timeoutMs: 100,
          }),
        (error: unknown) => error instanceof PinnedRequestTimeoutError
      );
    }
  );
});

test("fails closed (throws before connecting) when no pinned address is supplied", async () => {
  await assert.rejects(() =>
    performPinnedRequest({
      protocol: "http:",
      hostname: "example.com",
      pinnedAddress: "",
      port: 80,
      path: "/",
      headers: {},
      timeoutMs: 2000,
    })
  );
});

test("rejects on a connection error rather than hanging (nothing listening on the port)", async () => {
  await assert.rejects(() =>
    performPinnedRequest({
      protocol: "http:",
      hostname: "example.com",
      pinnedAddress: "127.0.0.1",
      port: 1, // reserved, nothing listens here
      path: "/",
      headers: {},
      timeoutMs: 2000,
    })
  );
});
