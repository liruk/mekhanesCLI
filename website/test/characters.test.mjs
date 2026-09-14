import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { loadCharacters, createNameLookup, renderCharacter } from '../scripts/characters.mjs';
const escape = new MarkdownIt().utils.escapeHtml;

test('YAML profiles preserve Japanese, multiline text, lists and nested mappings', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-characters-'));
  try {
    await mkdir(path.join(root, 'テスト人物'));
    await writeFile(path.join(root, 'テスト人物/profile.yaml'), 'name: テスト人物\nreading: てすとじんぶつ\nprofile:\n  age: 0\n  appearance: |\n    第一行\n    第二行\n  personality:\n    core: 冷静\n  ability:\n    - 調査: 観察を重ねる\nbackground:\n  - 来歴の一つ\n  - summary: 来歴の二つ\n');
    const [character] = await loadCharacters(root);
    const html = renderCharacter(character, escape, () => null);
    assert.ok(html.includes('第一行<br>第二行'));
    for (const text of ['冷静', '調査', '観察を重ねる', '来歴の一つ', '来歴の二つ', '<p>0</p>']) assert.ok(html.includes(text));
    assert.equal(character.url, `/world/characters/${encodeURIComponent('テスト人物')}/`);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('ambiguous aliases remain plain text and markup in YAML cannot execute', () => {
  const lookup = createNameLookup([{ names: ['名前A', '別名'], url: '/a/' }, { names: ['名前B', '別名'], url: '/b/' }]);
  assert.equal(lookup('名前A'), '/a/');
  assert.equal(lookup('別名'), null);
  const html = renderCharacter({ data: { name: '<script>alert(1)</script>', profile: { appearance: '<img src=x onerror=alert(1)>' }, relations: [{ target: '名前A', content: '<script>evil()</script>' }, { target: '別名', content: '曖昧な相手' }] } }, escape, lookup);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('<a href="/a/">名前A</a>'));
  assert.ok(html.includes('<dt>別名</dt>'));
});
test('malformed YAML or missing names fail the build instead of silently dropping a character', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-invalid-'));
  try {
    await mkdir(path.join(root, '人物'));
    const file = path.join(root, '人物/profile.yaml');
    await writeFile(file, 'name: [unfinished');
    await assert.rejects(loadCharacters(root), /Invalid character YAML/);
    await writeFile(file, 'profile: {}');
    await assert.rejects(loadCharacters(root), /Character name is required/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
