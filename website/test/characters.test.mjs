import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { stringify } from 'yaml';
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

test('only explicitly selected images are loaded, in YAML order, with escaped captions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-images-'));
  try {
    const directory = path.join(root, 'テスト人物');
    await mkdir(path.join(directory, 'images'), { recursive: true });
    for (const file of ['images/横向き.png', '正面.jpg', '未公開.png']) await writeFile(path.join(directory, file), 'fixture');
    const profile = { name: 'テスト人物', design: { reference_images: ['未公開.png'] }, publication: { images: [
      { src: 'images/横向き.png', alt: '横から見た設定画', caption: '<script>caption</script>' },
      { src: '正面.jpg' },
    ] } };
    await writeFile(path.join(directory, 'profile.yaml'), stringify(profile));
    const [character] = await loadCharacters(root);
    assert.equal(character.images.length, 2);
    assert.ok(character.images[0].source.endsWith('横向き.png'));
    const html = renderCharacter(character, escape, () => null);
    assert.equal((html.match(/<img /g) || []).length, 2);
    assert.ok(html.indexOf('design-1.png') < html.indexOf('design-2.jpg'));
    assert.ok(html.includes('alt="横から見た設定画"'));
    assert.ok(html.includes('alt="テスト人物の設定画"'));
    assert.ok(html.includes('&lt;script&gt;caption&lt;/script&gt;'));
    assert.ok(!html.includes('未公開') && !html.includes('<script>'));
    for (const publication of [undefined, { images: [] }]) {
      await writeFile(path.join(directory, 'profile.yaml'), stringify({ ...profile, publication }));
      const [hidden] = await loadCharacters(root);
      assert.deepEqual(hidden.images, []);
      assert.ok(!renderCharacter(hidden, escape, () => null).includes('<img '));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid, missing and external image references fail instead of publishing unintended files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-invalid-images-'));
  try {
    const directory = path.join(root, '人物');
    await mkdir(directory);
    await writeFile(path.join(directory, 'ok.png'), 'fixture');
    const invalid = [
      { images: Array(4).fill({ src: 'ok.png' }) }, { images: 'ok.png' },
      ...['../private.png', '/private.png', 'C:/private.png', 'https://example.com/a.png',
        'images\\a.png', 'profile.yaml', 'active.svg', 'missing.png'].map(src => ({ images: [{ src }] })),
      { images: [{ src: 'ok.png', alt: '' }] }, { images: [{ src: 'ok.png', caption: {} }] },
    ];
    for (const publication of invalid) {
      await writeFile(path.join(directory, 'profile.yaml'), stringify({ name: '人物', publication }));
      await assert.rejects(loadCharacters(root), /publication|Publication/);
    }
    await mkdir(path.join(root, 'private'));
    await writeFile(path.join(root, 'private/secret.png'), 'private fixture');
    await symlink(path.join(root, 'private'), path.join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(path.join(directory, 'profile.yaml'), stringify({ name: '人物', publication: { images: [{ src: 'linked/secret.png' }] } }));
    await assert.rejects(loadCharacters(root), /outside character directory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('only selected variants publish with distinct nested image URLs and two-way navigation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-variants-'));
  try {
    const parentDir = path.join(root, '元の人物');
    const variantDir = path.join(parentDir, 'variants/別の姿');
    await mkdir(variantDir, { recursive: true });
    await mkdir(path.join(parentDir, 'variants/未公開'));
    await writeFile(path.join(parentDir, 'variants/未公開/profile.yaml'), 'name: [unfinished');
    const parentData = { name: '元の人物', publication: { variants: ['別の姿'] } };
    await writeFile(path.join(parentDir, 'profile.yaml'), stringify(parentData));
    for (const file of ['human.png', 'hybrid.png', 'monster.png']) await writeFile(path.join(variantDir, file), 'fixture');
    await writeFile(path.join(variantDir, 'profile.yaml'), stringify({
      name: '別の姿', variant: { continuity: '<script>分岐</script>' },
      profile: { speech: { manner: '独り言', examples: ['台詞の例'] } },
      forms: { human: { name: '人間態', eyes: '黒い白目' } },
      production: { secret: '公開しない制作メモ' },
      publication: { images: ['human.png', 'hybrid.png', 'monster.png'].map(src => ({ src })) },
    }));
    const characters = await loadCharacters(root);
    assert.equal(characters.length, 2);
    const parent = characters.find(item => !item.parent);
    const variant = characters.find(item => item.parent);
    const expectedUrl = `/world/characters/${encodeURIComponent('元の人物')}/variants/${encodeURIComponent('別の姿')}/`;
    assert.equal(variant.url, expectedUrl);
    assert.equal(variant.parent.url, parent.url);
    assert.equal(parent.variants[0], variant);
    assert.deepEqual(variant.images.map(image => image.url), [1, 2, 3].map(index => `${expectedUrl}images/design-${index}.png`));
    const parentHtml = renderCharacter(parent, escape, () => null);
    const variantHtml = renderCharacter(variant, escape, () => null);
    assert.ok(parentHtml.includes(`href="${expectedUrl}"`));
    assert.ok(parentHtml.includes('別の姿・分岐'));
    assert.ok(variantHtml.includes(`href="${parent.url}"`));
    assert.ok(variantHtml.includes('&lt;script&gt;分岐&lt;/script&gt;'));
    for (const text of ['人間態', '黒い白目', '独り言', '台詞の例']) assert.ok(variantHtml.includes(text));
    assert.ok(!variantHtml.includes('<script>') && !variantHtml.includes('公開しない制作メモ'));
    assert.equal((variantHtml.match(/<img /g) || []).length, 3);
    await writeFile(path.join(parentDir, 'profile.yaml'), stringify({ name: '元の人物' }));
    assert.equal((await loadCharacters(root)).length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid, missing, and escaped variant selections fail without exposing other directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mekhanes-invalid-variants-'));
  try {
    const directory = path.join(root, '人物');
    await mkdir(path.join(directory, 'variants'), { recursive: true });
    const file = path.join(directory, 'profile.yaml');
    for (const variants of ['別の姿', [{}], [''], ['..'], ['a/b'], ['a\\b'], ['C:private'], ['重複', '重複'], ['存在しない']]) {
      await writeFile(file, stringify({ name: '人物', publication: { variants } }));
      await assert.rejects(loadCharacters(root), /variant/);
    }
    const privateDir = path.join(root, 'private');
    await mkdir(privateDir);
    await writeFile(path.join(privateDir, 'profile.yaml'), 'name: 非公開');
    await symlink(privateDir, path.join(directory, 'variants/外部'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(file, stringify({ name: '人物', publication: { variants: ['外部'] } }));
    await assert.rejects(loadCharacters(root), /outside character directory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
