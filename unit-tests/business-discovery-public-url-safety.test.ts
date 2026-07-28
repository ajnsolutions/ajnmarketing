import test from "node:test";
import assert from "node:assert/strict";
import {
  isBlockedHostLiteral,
  validatePublicSnapshotUrl,
  PublicSnapshotUrlError,
} from "../lib/business-discovery/public/urlSafety.ts";

async function expectRejected(url: string, resolver?: (h: string) => Promise<string[]>) {
  await assert.rejects(
    () => validatePublicSnapshotUrl(url, resolver ? { resolver } : {}),
    (error: unknown) => error instanceof PublicSnapshotUrlError
  );
}

const publicResolver = async () => ["93.184.216.34"]; // example.com's real public IP

test("accepts a valid public https website", async () => {
  const result = await validatePublicSnapshotUrl("https://example.com", { resolver: publicResolver });
  assert.equal(result.url, "https://example.com/");
  assert.equal(result.hostname, "example.com");
});

test("returns the validated resolved address as the pinned connection target", async () => {
  const result = await validatePublicSnapshotUrl("https://example.com", { resolver: publicResolver });
  assert.equal(result.pinnedAddress, "93.184.216.34");
  assert.equal(result.protocol, "https:");
  assert.equal(result.port, 443);
});

test("pins to the first validated address when DNS returns multiple answers", async () => {
  const multiAnswerResolver = async () => ["93.184.216.34", "93.184.216.35"];
  const result = await validatePublicSnapshotUrl("https://example.com", { resolver: multiAnswerResolver });
  assert.equal(result.pinnedAddress, "93.184.216.34");
});

test("a later, different DNS answer cannot retroactively change an already-validated pin", async () => {
  // Simulates the DNS-rebinding scenario directly: the resolver's *first* call
  // (at validation time) determines the pin; nothing later can un-pin it,
  // because validatePublicSnapshotUrl is the only place that ever calls the
  // resolver, and the returned pinnedAddress is then used verbatim by the
  // fetch layer without a second lookup (see fetchWebsite.ts / pinnedRequest.ts).
  let callCount = 0;
  const rebindingResolver = async () => {
    callCount += 1;
    return callCount === 1 ? ["93.184.216.34"] : ["10.0.0.5"]; // a hypothetical second call would return a private IP
  };
  const result = await validatePublicSnapshotUrl("https://example.com", { resolver: rebindingResolver });
  assert.equal(result.pinnedAddress, "93.184.216.34");
  assert.equal(callCount, 1); // confirms the resolver is never called a second time for this validation
});

test("an IP-literal URL pins to itself, bracket-free for IPv6", async () => {
  const ipv4Result = await validatePublicSnapshotUrl("http://93.184.216.34/");
  assert.equal(ipv4Result.pinnedAddress, "93.184.216.34");

  const ipv6Result = await validatePublicSnapshotUrl("http://[2001:4860:4860::8888]/");
  assert.equal(ipv6Result.pinnedAddress, "2001:4860:4860::8888");
});

test("accepts a bare domain and adds https automatically", async () => {
  const result = await validatePublicSnapshotUrl("example.com", { resolver: publicResolver });
  assert.equal(result.hostname, "example.com");
});

test("rejects an empty URL", async () => {
  await expectRejected("");
});

test("rejects a malformed URL", async () => {
  await expectRejected("http://[not-a-valid-host");
});

test("rejects unsupported schemes", async () => {
  await expectRejected("ftp://example.com/file");
  await expectRejected("file:///etc/passwd");
  await expectRejected("javascript:alert(1)");
});

test("rejects localhost", async () => {
  await expectRejected("http://localhost/");
  await expectRejected("http://LOCALHOST/");
});

test("rejects IPv4 loopback, including shorthand and obfuscated forms", async () => {
  await expectRejected("http://127.0.0.1/");
  await expectRejected("http://127.1/"); // Node's URL parser expands this to 127.0.0.1
  await expectRejected("http://2130706433/"); // decimal for 127.0.0.1
  await expectRejected("http://0x7f.0.0.1/"); // hex for 127.0.0.1
});

test("rejects IPv6 loopback", async () => {
  await expectRejected("http://[::1]/");
});

test("rejects private IPv4 ranges", async () => {
  await expectRejected("http://10.0.0.5/");
  await expectRejected("http://172.16.0.5/");
  await expectRejected("http://172.31.255.254/");
  await expectRejected("http://192.168.1.1/");
});

test("does not falsely block a public IPv4 address adjacent to a private range", async () => {
  assert.equal(isBlockedHostLiteral("172.32.0.1"), false); // just outside 172.16.0.0/12
  assert.equal(isBlockedHostLiteral("11.0.0.1"), false); // just outside 10.0.0.0/8
});

test("rejects link-local addresses, including the cloud metadata IP", async () => {
  await expectRejected("http://169.254.1.1/");
  await expectRejected("http://169.254.169.254/"); // AWS/GCP/Azure metadata endpoint
});

test("rejects the metadata.google.internal hostname directly", async () => {
  await expectRejected("http://metadata.google.internal/");
});

test("rejects IPv6 link-local and unique-local ranges", async () => {
  await expectRejected("http://[fe80::1]/");
  await expectRejected("http://[fc00::1]/");
  await expectRejected("http://[fd12::1]/");
});

test("rejects IPv4-mapped IPv6 addresses that embed a blocked IPv4 address", async () => {
  await expectRejected("http://[::ffff:127.0.0.1]/"); // loopback via IPv4-mapped IPv6
  await expectRejected("http://[::ffff:169.254.169.254]/"); // cloud metadata via IPv4-mapped IPv6
});

test("rejects credentials embedded in the URL", async () => {
  await expectRejected("http://user:pass@example.com/");
});

test("rejects a domain name that resolves to a private IP address", async () => {
  const rebindingResolver = async () => ["10.0.0.5"];
  await expectRejected("http://looks-public.example/", rebindingResolver);
});

test("rejects a domain name if any resolved address is blocked, even if others are public", async () => {
  const mixedResolver = async () => ["93.184.216.34", "127.0.0.1"];
  await expectRejected("http://mixed.example/", mixedResolver);
});

test("rejects when DNS resolution fails entirely", async () => {
  const failingResolver = async () => {
    throw new Error("ENOTFOUND");
  };
  await expectRejected("http://does-not-resolve.example/", failingResolver);
});

test("never performs a DNS lookup for an IP literal (resolver is not called)", async () => {
  let called = false;
  const resolver = async () => {
    called = true;
    return ["93.184.216.34"];
  };
  const result = await validatePublicSnapshotUrl("http://93.184.216.34/", { resolver });
  assert.equal(result.hostname, "93.184.216.34");
  assert.equal(called, false);
});
