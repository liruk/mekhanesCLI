import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { loadCharacters } from '../scripts/characters.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'website/dist');
const config = JSON.parse(await readFile(path.join(root, 'website/publication.json'), 'utf8'));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(file)); else result.push(file);
  }
  return result;
}
test('all internal navigation and local assets resolve in the static output', async () => {
  for (const file of (await files(dist)).filter(file => file.endsWith('.html'))) {
    const html = await readFile(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      if (match[1].startsWith('//')) continue;
      const target = path.join(dist, decodeURIComponent(match[1]));
      assert.ok(await stat(target).catch(() => null), `Missing target in ${file}: ${match[1]}`);
    }
  }
});
test('every published chapter preserves the complete manuscript and links to its neighbors', async () => {
  const escape = new MarkdownIt().utils.escapeHtml;
  for (const work of config.works) {
    for (const [index, chapter] of work.chapters.entries()) {
      const original = await readFile(path.join(root, 'publish', work.slug, chapter.source), 'utf8');
      const html = await readFile(path.join(dist, 'works', work.slug, chapter.slug, 'index.html'), 'utf8');
      if (chapter.source.endsWith('.txt')) assert.ok(html.includes(escape(original)));
      if (index) assert.ok(html.includes(`/works/${work.slug}/${work.chapters[index - 1].slug}/`));
      if (index < work.chapters.length - 1) assert.ok(html.includes(`/works/${work.slug}/${work.chapters[index + 1].slug}/`));
    }
  }
});
test('private work areas, SQLite, source profiles, recipient and secrets are absent from output', async () => {
  for (const file of await files(dist)) {
    assert.ok(!/\.(db|yaml|txt|zip|wav)$/.test(file) || file.endsWith('robots.txt'));
    if (/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const text = await readFile(file, 'utf8');
    assert.ok(!text.includes('work.liruk@gmail.com'));
    assert.ok(!text.includes('TURNSTILE_SECRET_KEY'));
    assert.ok(!text.includes('products/THE_WITCH_OF_MIASMA'));
  }
  for (const name of ['products', 'archive', 'chaimsphere', 'publish']) assert.equal(await stat(path.join(dist, name)).catch(() => null), null);
});

test('published images exactly match the YAML selection and preserve original bytes', async () => {
  const characters = await loadCharacters(path.join(root, 'mekhanes'));
  const expected = [];
  for (const character of characters) {
    const html = await readFile(path.join(dist, decodeURIComponent(character.url), 'index.html'), 'utf8');
    assert.equal((html.match(/<img /g) || []).length, character.images.length);
    for (const image of character.images) {
      const target = path.join(dist, decodeURIComponent(image.url));
      expected.push(target);
      assert.ok(html.includes(`src="${image.url}"`) && html.includes(`href="${image.url}"`));
      assert.deepEqual(await readFile(target), await readFile(image.source));
    }
  }
  const actual = (await files(dist)).filter(file => /\.(png|jpe?g|webp)$/i.test(file));
  assert.deepEqual(actual.sort(), expected.sort());
});

test('world navigation separates settings, corporations and every YAML character into child indexes', async () => {
  const hub = await readFile(path.join(dist, 'world/index.html'), 'utf8');
  for (const category of ['settings', 'corporations', 'characters']) assert.ok(hub.includes(`href="/world/${category}/"`));
  assert.ok(!hub.includes('href="/world/history/"'));
  const settings = await readFile(path.join(dist, 'world/settings/index.html'), 'utf8');
  assert.ok(settings.includes('href="/world/history/"'));
  assert.ok(!settings.includes('href="/world/mega-corps/'));
  const corporations = await readFile(path.join(dist, 'world/corporations/index.html'), 'utf8');
  assert.ok(corporations.includes('href="/world/mega-corps/"'));
  const index = await readFile(path.join(dist, 'world/characters/index.html'), 'utf8');
  const characters = await loadCharacters(path.join(root, 'mekhanes'));
  assert.ok(characters.length > 0);
  assert.equal((index.match(/href="\/world\/characters\/[^"/]+\/"/g) || []).length, characters.length);
  for (const character of characters) {
    assert.ok(index.includes(`href="${character.url}"`));
    const html = await readFile(path.join(dist, decodeURIComponent(character.url), 'index.html'), 'utf8');
    assert.ok(html.includes(`<h1>${new MarkdownIt().utils.escapeHtml(character.data.name)}</h1>`));
    assert.ok(html.includes('href="/world/characters/"'));
    assert.ok(html.includes('href="/world/"'));
  }
  const sylviana = await readFile(path.join(dist, 'world/characters/シルヴィアナメギルクロック/index.html'), 'utf8');
  assert.ok(sylviana.includes(`/world/characters/${encodeURIComponent('ゲイリースー')}/`));
  assert.ok(sylviana.includes(`/world/mega-corps/${encodeURIComponent('スカイハブ')}/`));
});
