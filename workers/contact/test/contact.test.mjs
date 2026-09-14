import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact } from '../src/index.mjs';

const origin = 'https://mekhanes.3lraven.net';
const good = { name: '読者', email: 'reader@example.net', subject: '作品について', message: 'お問い合わせの本文です。', 'cf-turnstile-response': 'test-token' };
const request = (data = good, headers = {}) => new Request(`${origin}/api/contact`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers }, body: JSON.stringify(data),
});
function setup() {
  const messages = [];
  const env = { ALLOWED_ORIGIN: origin, MAIL_FROM: 'contact@mekhanes.3lraven.net', MAIL_TO: 'owner@example.net', TURNSTILE_SECRET_KEY: 'test-secret', EMAIL: { send: async (message) => messages.push(message) }, CONTACT_LIMITER: { limit: async () => ({ success: true }) } };
  const verify = async () => Response.json({ success: true, hostname: 'mekhanes.3lraven.net', action: 'contact' });
  return { env, messages, verify };
}
test('valid Japanese inquiry sends once to the configured owner, with reader only as replyTo', async () => {
  const { env, messages, verify } = setup();
  const result = await handleContact(request({ ...good, to: 'attacker@example.net' }), env, verify);
  assert.equal(result.status, 200);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, env.MAIL_TO);
  assert.equal(messages[0].from, env.MAIL_FROM);
  assert.equal(messages[0].replyTo, good.email);
  assert.ok(messages[0].text.includes(good.message));
  assert.equal(result.headers.get('cache-control'), 'no-store');
});
test('untrusted origins, header injection, malformed input and oversized text never send', async () => {
  const cases = [
    [request(good, { Origin: 'https://other.example' }), 403],
    [request({ ...good, email: 'x@example.net\r\nBcc: attacker@example.net' }), 400],
    [request({ ...good, subject: 'hello\r\nBcc: attacker@example.net' }), 400],
    [request(null), 400], [request({ ...good, message: 'あ'.repeat(5001) }), 400],
    [request({ ...good, website: 'https://spam.example' }), 400],
    [request(good, { 'Content-Type': 'text/plain' }), 415],
  ];
  for (const [req, status] of cases) {
    const { env, messages } = setup();
    const result = await handleContact(req, env, () => { throw new Error('Verification must not run'); });
    assert.equal(result.status, status);
    assert.equal(messages.length, 0);
  }
});
test('rejects an oversized streaming body without Content-Length', async () => {
  const { env, messages, verify } = setup();
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(33000)); controller.close(); } });
  const req = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  assert.equal((await handleContact(req, env, verify)).status, 413);
  assert.equal(messages.length, 0);
});
test('expired, replayed, wrong-host and wrong-action Turnstile results never send', async () => {
  for (const result of [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, { success: true, hostname: 'other.example', action: 'contact' }, { success: true, hostname: 'mekhanes.3lraven.net', action: 'login' }]) {
    const { env, messages } = setup();
    assert.equal((await handleContact(request(), env, async () => Response.json(result))).status, 400);
    assert.equal(messages.length, 0);
  }
});
test('rate limit rejects before verification or sending', async () => {
  const { env, messages } = setup();
  env.CONTACT_LIMITER.limit = async () => ({ success: false });
  assert.equal((await handleContact(request(), env, () => { throw new Error('Must not verify'); })).status, 429);
  assert.equal(messages.length, 0);
});
test('missing secret and external failures return unavailable without false success or leaked error details', async () => {
  const { env, messages, verify } = setup();
  assert.equal((await handleContact(request(), { ...env, TURNSTILE_SECRET_KEY: '' }, verify)).status, 503);
  assert.equal(messages.length, 0);
  assert.equal((await handleContact(request(), env, async () => { throw new Error('secret detail'); })).status, 503);
  env.EMAIL.send = async () => { throw new Error('secret detail'); };
  const response = await handleContact(request(), env, verify);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('secret detail'));
});
