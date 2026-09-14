const MAX_BYTES = 32768;
const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
function reply(status, error) {
  return Response.json(error ? { ok: false, error } : { ok: true }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new RangeError();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export async function handleContact(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/contact') return reply(404, 'ページが見つかりません。');
  if (request.method !== 'POST') return reply(405, 'POSTで送信してください。');
  if (!env.ALLOWED_ORIGIN || !env.TURNSTILE_SECRET_KEY || !env.EMAIL || !env.CONTACT_LIMITER ||
      !emailPattern.test(env.MAIL_FROM || '') || !emailPattern.test(env.MAIL_TO || '')) {
    return reply(503, 'ただいま受付を準備しています。');
  }
  if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return reply(403, 'サイトのお問い合わせフォームから送信してください。');
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return reply(415, '送信形式が正しくありません。');
  let data;
  try { data = await readBody(request); }
  catch (error) { return reply(error instanceof RangeError ? 413 : 400, '送信内容またはサイズが正しくありません。'); }
  if (!data || Array.isArray(data) || typeof data !== 'object') return reply(400, '入力内容を確認してください。');
  const valid = (key, max) => typeof data[key] === 'string' && data[key].trim().length > 0 && data[key].length <= max;
  if (!valid('name', 100) || !valid('email', 254) || !valid('subject', 150) || !valid('message', 5000) ||
      !valid('cf-turnstile-response', 2048) || !emailPattern.test(data.email) || /[\r\n\x00]/.test(data.name + data.subject)) {
    return reply(400, '入力内容と認証を確認してください。');
  }
  if (data.website) return reply(400, '送信内容を確認してください。');
  try {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return reply(403, '送信元を確認できませんでした。');
    const limit = await env.CONTACT_LIMITER.limit({ key: ip });
    if (!limit.success) return reply(429, '送信回数が多いため、少し待ってからお試しください。');
    const verification = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: data['cf-turnstile-response'], remoteip: ip }),
      signal: AbortSignal.timeout(10000),
    });
    if (!verification.ok) return reply(503, '認証サービスに接続できませんでした。もう一度お試しください。');
    const result = await verification.json();
    if (result.success !== true || result.hostname !== new URL(env.ALLOWED_ORIGIN).hostname || result.action !== 'contact') {
      return reply(400, '認証の有効期限が切れたか、認証できませんでした。もう一度お試しください。');
    }
    await env.EMAIL.send({
      from: env.MAIL_FROM,
      to: env.MAIL_TO,
      replyTo: data.email.trim(),
      subject: `[メーカネース・ナーヴィス] ${data.subject.trim()}`,
      text: `お名前: ${data.name.trim()}\n返信先: ${data.email.trim()}\n\n${data.message.trim()}`,
    });
    return reply(200);
  } catch {
    return reply(503, '送信を完了できませんでした。時間をおいてお試しください。');
  }
}
export default { fetch: (request, env) => handleContact(request, env) };
