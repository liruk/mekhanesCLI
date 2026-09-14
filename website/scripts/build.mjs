import { readFile, writeFile, mkdir, readdir, rm, copyFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { loadCharacters, createNameLookup, renderCharacter } from './characters.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const output = path.join(root, 'website/dist');
const config = JSON.parse(await readFile(path.join(root, 'website/publication.json'), 'utf8'));
const md = new MarkdownIt({ html: false, linkify: true });
const esc = (value) => md.utils.escapeHtml(String(value));
const siteUrl = new URL(config.url);
if (siteUrl.protocol !== 'https:') throw new Error('Site URL must use HTTPS');
const publicKey = process.env.TURNSTILE_SITE_KEY || '';
if (publicKey && !/^[a-zA-Z0-9_-]+$/.test(publicKey)) throw new Error('Invalid Turnstile site key');
const pages = new Map();
const sourceUrls = new Map();
const slug = (value) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new Error(`Invalid slug: ${value}`);
  return value;
};
async function sourceFile(base, relative) {
  const basePath = await realpath(base);
  const full = await realpath(path.resolve(basePath, relative));
  const rel = path.relative(basePath, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Source outside content directory: ${relative}`);
  if (!/\.(md|txt)$/.test(full)) throw new Error(`Unsupported source: ${relative}`);
  return full;
}
function add(url, title, content, source = null, parent = null) {
  if (pages.has(url)) throw new Error(`Duplicate URL: ${url}`);
  pages.set(url, { title, content, source, parent });
  if (source) sourceUrls.set(source, url);
}
const worldRoot = path.join(root, 'mekhanes/world');
const docs = [...config.worldDocuments];
if (config.corporations) {
  docs.push(...(await readdir(path.join(worldRoot, 'mega-corps'))).filter(n => n.endsWith('.md')).sort().map(n => `mega-corps/${n}`));
}
const docLinks = [];
const corpLinks = [];
const namedEntries = [];
for (const relative of docs) {
  const file = await sourceFile(worldRoot, relative);
  const text = await readFile(file, 'utf8');
  const title = text.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
  const url = '/world/' + relative.replace(/\.md$/, '').split('/').map(encodeURIComponent).join('/') + '/';
  const corporation = relative.startsWith('mega-corps/');
  const corporateOverview = relative === 'mega-corps.md';
  add(url, title, text, file, corporation || corporateOverview ? '/world/corporations/' : '/world/settings/');
  if (corporation) {
    corpLinks.push(`<li><a href="${url}">${esc(title)}</a></li>`);
    namedEntries.push({ names: [title, path.basename(file, '.md')], url });
  } else if (!corporateOverview) docLinks.push(`<li><a href="${url}">${esc(title)}</a></li>`);
}
const characters = config.characters ? await loadCharacters(path.join(root, 'mekhanes')) : [];
for (const character of characters) namedEntries.push({ names: [character.directory, character.data.name, ...(Array.isArray(character.data.aliases) ? character.data.aliases : [])], url: character.url });
const lookup = createNameLookup(namedEntries);
for (const character of characters) add(character.url, character.data.name, renderCharacter(character, esc, lookup), null, '/world/characters/');
const categories = [
  { url: '/world/settings/', title: '世界設定', english: 'WORLD', description: '歴史、マナと異能、星々の仕組み。', count: docLinks.length },
  { url: '/world/corporations/', title: '企業', english: 'CORPORATIONS', description: '文明を動かすメガコーポと、その思想。', count: corpLinks.length },
  { url: '/world/characters/', title: 'キャラクター', english: 'CHARACTERS', description: 'この世界に生きる人々と、交わる関係。', count: characters.length },
];
add('/world/', '世界観', `<p class="eyebrow">EXPLORE THE WORLD</p><h1>世界観</h1><p>世界の仕組みから、企業、そこに生きる人々へ。</p><div class="category-cards">${categories.map(item => `<a href="${item.url}"><span class="eyebrow">${item.english}</span><h2>${item.title}</h2><p>${item.description}</p><span class="muted">${item.count}件の資料 <span aria-hidden="true">↗</span></span></a>`).join('')}</div>`);
add('/world/settings/', '世界設定', `<h1>世界設定</h1><p>歴史、マナと異能、星々の仕組み。</p><ul class="index-list">${docLinks.join('')}</ul>`, null, '/world/');
add('/world/corporations/', '企業', `<h1>企業</h1><p>文明を動かすメガコーポと、その思想。</p>${config.worldDocuments.includes('mega-corps.md') ? '<p><a href="/world/mega-corps/">メガコーポの概要を読む</a></p>' : ''}<ul class="index-list">${corpLinks.join('')}</ul>`, null, '/world/');
add('/world/characters/', 'キャラクター', `<h1>キャラクター</h1><p>この世界に生きる人々。名前を選ぶと、その人物の設定を読めます。</p><ul class="index-list character-index">${characters.map(character => `<li><a href="${character.url}">${esc(character.data.name)}</a>${character.data.reading ? `<p>${esc(character.data.reading)}</p>` : ''}</li>`).join('')}</ul>`, null, '/world/');
const guideline = path.join(root, 'mekhanes/fan-content-guidelines.md');
add('/guidelines/', '二次創作・ファン活動ガイドライン', await readFile(guideline, 'utf8'), guideline);
const workLinks = [];
for (const work of config.works) {
  const id = slug(work.slug);
  if (!work.chapters?.length) throw new Error(`No chapters: ${id}`);
  const chapterLinks = [];
  for (const [index, chapter] of work.chapters.entries()) {
    const file = await sourceFile(path.join(root, 'publish', id), chapter.source);
    const url = `/works/${id}/${slug(chapter.slug)}/`;
    const text = await readFile(file, 'utf8');
    const content = file.endsWith('.txt') ? `<h1>${esc(chapter.title)}</h1><div class="novel">${esc(text)}</div>` : md.render(text);
    const prev = work.chapters[index - 1];
    const next = work.chapters[index + 1];
    const nav = `<nav class="chapter-nav" aria-label="作品のページ">${prev ? `<a href="/works/${id}/${slug(prev.slug)}/">前の話</a>` : ''}<a href="/works/${id}/">目次</a>${next ? `<a href="/works/${id}/${slug(next.slug)}/">次の話</a>` : ''}</nav>`;
    add(url, `${chapter.title} — ${work.title}`, content + nav);
    chapterLinks.push(`<li><a href="${url}">${esc(chapter.title)}</a></li>`);
  }
  add(`/works/${id}/`, work.title, `<h1>${esc(work.title)}</h1><p>${esc(work.description || '')}</p>${work.rating ? `<p class="muted">${esc(work.rating)}</p>` : ''}<ol class="index-list">${chapterLinks.join('')}</ol>`);
  workLinks.push(`<li><a href="/works/${id}/">${esc(work.title)}</a><p>${esc(work.description || '')}</p></li>`);
}
add('/works/', '作品', `<h1>作品</h1>${workLinks.length ? `<ul class="index-list">${workLinks.join('')}</ul>` : '<p>作品本文の掲載を準備しています。</p>'}`);
add('/', config.title, `<section class="hero"><p class="eyebrow">WORLD & STORIES</p><h1>メーカネース・<br>ナーヴィス</h1><p class="lead">進歩する人に、<br>神が世界の管理を委ねた。</p><p>機械仕掛けの船で星々を渡る文明。<br>マナと魔物、企業と異能。そのあいだで生きる、人々の物語。</p><a class="button" href="/world/">世界を知る <span aria-hidden="true">↗</span></a></section><section class="cards"><a href="/world/"><span>01 / WORLD</span><h2>世界観資料</h2><p>この世界の歴史と仕組みを読む。</p></a><a href="/works/"><span>02 / STORIES</span><h2>作品</h2><p>物語から、この世界へ。</p></a><a href="/guidelines/"><span>03 / FAN WORKS</span><h2>二次創作について</h2><p>創作を楽しむためのガイドライン。</p></a></section>`);
add('/contact/', 'お問い合わせ', `<h1>お問い合わせ</h1><p>作品や二次創作についてのご連絡はこちらから。</p>${publicKey ? `<form id="contact-form" action="/api/contact" method="post"><label>お名前<input name="name" autocomplete="name" maxlength="100" required></label><label>返信用メールアドレス<input name="email" type="email" autocomplete="email" maxlength="254" required></label><label>件名<input name="subject" maxlength="150" required></label><label>お問い合わせ内容<textarea name="message" rows="10" maxlength="5000" required></textarea></label><div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><p class="muted">入力された情報は、お問い合わせへの対応と返信に使用します。送信時にCloudflare Turnstileによる不正利用の確認を行います。</p><div class="cf-turnstile" data-sitekey="${esc(publicKey)}" data-action="contact"></div><button type="submit">送信する</button><p id="form-status" role="status" aria-live="polite"></p><noscript>送信にはJavaScriptを有効にしてください。</noscript></form><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><script src="/contact.js" defer></script>` : '<p>お問い合わせフォームは準備中です。</p>'}`);
add('/404.html', 'ページが見つかりません', '<h1>ページが見つかりません</h1><p><a href="/">トップページへ戻る</a></p>');

// Resolve local Markdown links against the publication list, never against the entire repository.
const defaultLink = md.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
const brokenLinks = [];
md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  const href = token.attrGet('href');
  if (env.source && href && !/^(?:[a-z]+:|\/|#)/i.test(href)) {
    const [relative, anchor] = href.split('#');
    const target = path.resolve(path.dirname(env.source), decodeURIComponent(relative));
    const url = sourceUrls.get(target);
    if (!url) brokenLinks.push(`${env.source}: ${decodeURIComponent(href)}`);
    else token.attrSet('href', url + (anchor ? '#' + anchor : ''));
  }
  return defaultLink(tokens, index, options, env, renderer);
};
for (const page of pages.values()) {
  page.html = page.source ? md.render(page.content, { source: page.source }) : page.content;
}
if (brokenLinks.length) throw new Error(`Unpublished links:\n${brokenLinks.join('\n')}`);
// The output path is fixed within website/; clear it to avoid keeping unpublished pages.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const [url, page] of pages) {
  const trail = [];
  let parentUrl = page.parent;
  while (parentUrl) {
    const parent = pages.get(parentUrl);
    if (!parent) throw new Error(`Missing parent page: ${parentUrl}`);
    trail.unshift(`<a href="${parentUrl}">${esc(parent.title)}</a>`);
    parentUrl = parent.parent;
  }
  const breadcrumbs = trail.length ? `<nav class="breadcrumbs" aria-label="現在の位置">${trail.join('<span aria-hidden="true">/</span>')}<span aria-hidden="true">/</span><span aria-current="page">${esc(page.title)}</span></nav>` : '';
  const body = breadcrumbs + page.html;
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | ${esc(config.title)}</title><meta name="description" content="メーカネース・ナーヴィスの世界観資料と作品。"><link rel="canonical" href="${esc(new URL(url, config.url).href)}"><link rel="stylesheet" href="/style.css"></head><body><a class="skip" href="#main">本文へ</a><header><a class="brand" href="/">MEKHANES NAVIS<span>メーカネース・ナーヴィス</span></a><nav aria-label="メイン"><a href="/world/">世界観</a><a href="/works/">作品</a><a href="/contact/">お問い合わせ</a></nav></header><main id="main" class="${url === '/' ? 'home' : 'reader'}">${body}</main><footer><a href="/guidelines/">二次創作ガイドライン</a><span>メーカネース・ナーヴィス</span></footer></body></html>`;
  const target = path.join(output, url === '/404.html' ? '404.html' : `${decodeURIComponent(url)}/index.html`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}
for (const name of ['style.css', 'contact.js', '_headers']) await copyFile(path.join(root, 'website/public', name), path.join(output, name));
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
await writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...pages.keys()].filter(url => url !== '/404.html').map(url => `<url><loc>${esc(new URL(url, config.url).href)}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${pages.size} pages in website/dist (${config.works.length} works).`);
