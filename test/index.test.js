import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Only replace the network boundary; execute the real Worker handler.
const source = (await readFile(new URL("../src/index.js", import.meta.url), "utf8"))
  .replace('import { request as stealthRequest } from "stealth-fetch/web";',
    "const stealthRequest = (...args) => globalThis.mockUpstream(...args);");
const { default: worker } = await import("data:text/javascript," + encodeURIComponent(source));
crypto.subtle.timingSafeEqual ??= timingSafeEqual;

test("API_KEY gates POST, permits preflight, and never reaches upstream", async () => {
  let calls = 0;
  globalThis.mockUpstream = async (url, options) => {
    calls++;
    assert.equal(url, "https://index-translate.bilibili.com/v1/chat/completions");
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ choices: [{ message: { content: "你好" } }] });
  };
  const payload = { model: "Index-Translate-35B-A3B", messages: [{ role: "user", content: "Hello" }] };
  const request = (key, body = JSON.stringify(payload)) => new Request("https://worker.test/v1/chat/completions", {
    method: "POST", headers: key ? { Authorization: "Bearer " + key } : {}, body,
  });
  const env = { API_KEY: "test-only-key" };
  assert.equal((await worker.fetch(request(), env)).status, 401);
  assert.equal((await worker.fetch(request("wrong"), env)).status, 401);
  assert.equal((await worker.fetch(request("test-only-keX"), env)).status, 401);
  assert.equal((await worker.fetch(request("test-only-key"), {})).status, 503);
  const preflight = await worker.fetch(new Request("https://worker.test/v1/chat/completions", { method: "OPTIONS" }), env);
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal((await worker.fetch(new Request("https://worker.test/"), env)).status, 405);
  assert.equal(calls, 0);
  assert.equal((await worker.fetch(request("test-only-key", "{"), env)).status, 400);
  assert.equal(calls, 0);
  const response = await worker.fetch(request("test-only-key"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).choices[0].message.content, "你好");
  assert.equal(calls, 1);
});
