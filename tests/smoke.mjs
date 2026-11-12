import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const file = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const cnfCtx = { window: {} };
vm.runInNewContext(file("cloud-config.js"), cnfCtx);
const config = cnfCtx.window.PIECE_CLOUD_CONFIG;

test("frontend and worker JavaScript parses", () => {
  for (const name of ["app.js", "cloud.js", "cloud-config.js", "lessons.js"]) {
    assert.doesNotThrow(() => new vm.Script(file(name), { filename: name }));
  }
  assert.doesNotThrow(() => new vm.Script(file("cloudflare/worker.js").replace("export default", "const deployedWorker = "), { filename: "worker.js" }));
  const html = file("index.html");
  for (const name of ["cloud.js", "cloud-config.js", "cloud.css", "app.js", "lessons.js"]) {
    assert.ok(html.includes(name), "index.html should include " + name);
  }
});
test("client includes no privileged API keys", () => {
  assert.match(config.supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  assert.match(config.publishableKey, /^sb_publishable_/);
  assert.match(config.aiEndpoint, /^https:\/\/[a-z0-9-]+\.workers\.dev\/feedback$/);
  for (const name of ["cloud-config.js", "cloud.js", "index.html"]) {
    assert.doesNotMatch(file(name), /sb_secret_[A-Za-z0-9_-]+|sk-proj-/);
  }
});
async function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(16000) });
}
test("Cloudflare Worker requires authentication", async () => {
  const resp = await request(config.aiEndpoint, {
    method: "POST",
    headers: { "Origin": "https://piece-plus.vercel.app", "Content-Type": "application/json" },
    body: JSON.stringify({ answer: "测试学习问题" }),
  });
  assert.equal(resp.status, 401, "missing bearer token must be rejected");
  assert.equal(resp.headers.get("access-control-allow-origin"), "https://piece-plus.vercel.app");
});
test("Cloudflare Worker CORS preflight only accepts production origin", async () => {
  const allow = await request(config.aiEndpoint, {
    method: "OPTIONS",
    headers: { Origin: "https://piece-plus.vercel.app", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
  });
  assert.equal(allow.status, 204);
  assert.equal(allow.headers.get("access-control-allow-origin"), "https://piece-plus.vercel.app");
  const deny = await request(config.aiEndpoint, {
    method: "OPTIONS",
    headers: { Origin: "https://malicious.example", "Access-Control-Request-Method": "POST" },
  });
  assert.equal(deny.status, 403);
  assert.notEqual(deny.headers.get("access-control-allow-origin"), "https://malicious.example");
});
test("Supabase does not expose private notes to anonymous callers", async () => {
  const resp = await request(config.supabaseUrl + "/rest/v1/piece_items?select=item_id&limit=2", {
    headers: { apikey: config.publishableKey, "Accept": "application/json" },
  });
  // 401/403 is expected when anon has no table grant. RLS may also return [].
  if (resp.status === 200) {
    const data = await resp.json();
    assert.ok(Array.isArray(data) && data.length === 0, "anonymous user must not read any notes");
  } else assert.ok([401, 403].includes(resp.status), "unexpected anon HTTP status " + resp.status);
});
