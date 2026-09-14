import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

export const characterUrl = (directory) => `/world/characters/${encodeURIComponent(directory)}/`;

async function loadImages(directory, data, profileFile) {
  const publication = data.publication;
  if (publication === undefined) return [];
  if (!publication || typeof publication !== 'object' || Array.isArray(publication)) {
    throw new Error(`Invalid publication settings: ${profileFile}`);
  }
  const entries = publication.images ?? [];
  if (!Array.isArray(entries) || entries.length > 2) {
    throw new Error(`publication.images must be an array of at most 2 images: ${profileFile}`);
  }
  const base = await realpath(directory);
  const images = [];
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.src !== 'string' || !entry.src ||
        entry.src.split('/').some(part => !part || part === '.' || part === '..') ||
        /[\\:\x00]/.test(entry.src) ||
        (entry.alt !== undefined && (typeof entry.alt !== 'string' || !entry.alt.trim())) ||
        (entry.caption !== undefined && typeof entry.caption !== 'string')) {
      throw new Error(`Invalid publication image ${index + 1}: ${profileFile}`);
    }
    const extension = path.extname(entry.src).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) {
      throw new Error(`Unsupported publication image: ${profileFile}: ${entry.src}`);
    }
    let source;
    try { source = await realpath(path.join(base, entry.src)); }
    catch (error) { throw new Error(`Missing publication image: ${profileFile}: ${entry.src}`, { cause: error }); }
    const relative = path.relative(base, source);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(source)).isFile()) {
      throw new Error(`Publication image outside character directory or not a file: ${profileFile}: ${entry.src}`);
    }
    images.push({ source, url: `${characterUrl(path.basename(directory))}images/design-${index + 1}${extension}`,
      alt: entry.alt || `${data.name}の設定画`, caption: entry.caption || '' });
  }
  return images;
}

export async function loadCharacters(worldRoot) {
  const characters = [];
  for (const entry of await readdir(worldRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'world') continue;
    const file = path.join(worldRoot, entry.name, 'profile.yaml');
    let text;
    try { text = await readFile(file, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    let data;
    try { data = parse(text, { maxAliasCount: 100 }); }
    catch (error) { throw new Error(`Invalid character YAML: ${file}`, { cause: error }); }
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error(`Character name is required: ${file}`);
    }
    const images = await loadImages(path.dirname(file), data, file);
    characters.push({ directory: entry.name, url: characterUrl(entry.name), data, images });
  }
  return characters.sort((a, b) => String(a.data.reading || a.data.name).localeCompare(String(b.data.reading || b.data.name), 'ja') || a.directory.localeCompare(b.directory, 'ja'));
}

// A name shared by multiple entries is ambiguous; leave it as text instead of choosing one.
export function createNameLookup(entries) {
  const urls = new Map();
  for (const { names, url } of entries) {
    for (const name of names) {
      if (typeof name !== 'string' || !name.trim()) continue;
      const key = name.trim();
      if (!urls.has(key)) urls.set(key, url);
      else if (urls.get(key) !== url) urls.set(key, null);
    }
  }
  return name => typeof name === 'string' ? urls.get(name.trim()) : null;
}

const labels = {
  name: '名前', detail: '詳細', summary: '概要', details: '詳細', value: '評価', rank: 'ランク',
  appearance: '外見', personality: '性格', age: '年齢', age_detail: '年齢について', birth_year: '生年',
  species: '種族', occupation: '職業', affiliation: '所属', origin: '出自', role_in_story: '物語での役割',
  body: '身体', identity: '自認', core: '核となる性質', surface: '表向き', true: '内面',
  public_reputation: '世間での評判', private_truth: '内実', former_role: 'かつての役割', current_role: '現在の役割',
  first_person: '一人称', second_person: '二人称', style: '話し方', sample_lines: '台詞例',
  combat: '戦闘', social_and_intel: '対人・情報収集', body_and_art: '身体技能・芸術',
  life_goal: '人生の目標', contradiction: '葛藤', alignment: '信条', self_recognition: '自己認識',
  line_crossed: '踏み越える一線', line_not_crossed: '踏み越えない一線',
};
const hasValue = value => value !== undefined && value !== null && value !== '' &&
  (!Array.isArray(value) || value.length > 0) && (typeof value !== 'object' || Object.keys(value).length > 0);

export function renderValue(value, escape) {
  if (!hasValue(value)) return '';
  if (Array.isArray(value)) return `<ul>${value.filter(hasValue).map(item => `<li>${renderValue(item, escape)}</li>`).join('')}</ul>`;
  if (typeof value === 'object') {
    return `<dl class="profile-fields">${Object.entries(value).filter(([, item]) => hasValue(item)).map(([key, item]) => `<div><dt>${escape(labels[key] || key)}</dt><dd>${renderValue(item, escape)}</dd></div>`).join('')}</dl>`;
  }
  return `<p>${escape(String(value)).replace(/\r?\n/g, '<br>')}</p>`;
}

export function renderCharacter(character, escape, lookup) {
  const { data } = character;
  const profile = data.profile || {};
  const basics = Object.fromEntries(['age', 'age_detail', 'birth_year', 'species', 'occupation', 'affiliation', 'origin', 'role_in_story'].filter(key => hasValue(profile[key])).map(key => [key, profile[key]]));
  if (hasValue(profile.sex?.body)) basics['性別'] = profile.sex.body;
  const section = (title, value) => hasValue(value) ? `<section class="character-section"><h2>${escape(title)}</h2>${renderValue(value, escape)}</section>` : '';
  const aliases = Array.isArray(data.aliases) ? data.aliases.filter(name => typeof name === 'string') : [];
  const relations = Array.isArray(data.relations) ? data.relations.filter(rel => rel && typeof rel.target === 'string') : [];
  const images = character.images || [];
  const gallery = images.length ? `<section class="character-gallery" aria-label="設定画">${images.map((image, index) => `<figure><a href="${escape(image.url)}" target="_blank" rel="noopener" aria-label="${escape(image.alt)}（原寸画像を新しいタブで開く）"><img src="${escape(image.url)}" alt="${escape(image.alt)}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async"></a><figcaption>${image.caption ? `${escape(image.caption)} · ` : ''}<a href="${escape(image.url)}" target="_blank" rel="noopener">原寸で見る<span class="sr-only">（新しいタブ）</span> ↗</a></figcaption></figure>`).join('')}</section>` : '';
  return `<p class="eyebrow">CHARACTER</p><h1>${escape(data.name)}</h1>${data.reading ? `<p class="character-reading">${escape(data.reading)}</p>` : ''}${aliases.length ? `<p class="muted">別名：${aliases.map(escape).join(' ／ ')}</p>` : ''}` +
    gallery +
    section('プロフィール', basics) + section('外見', profile.appearance) + section('性格', profile.personality) +
    section('能力', profile.ability) + section('能力の詳細', data.abilities) + section('固有技能', data.unique_skills) +
    section('背景', data.background) + section('装備', data.equipment) + section('技能', data.skills) +
    section('話し方', data.speech) + section('台詞', data.quotes) + section('好きなもの', data.favorites) +
    section('苦手なもの', data.dislikes) + section('目標', data.goals) + section('動機', data.motivation) +
    section('信条', data.ethics) + section('弱点', data.weaknesses) +
    (relations.length ? `<section class="character-section"><h2>関係性</h2><dl class="character-relations">${relations.map(rel => {
      const url = lookup(rel.target);
      return `<div><dt>${url ? `<a href="${escape(url)}">${escape(rel.target)}</a>` : escape(rel.target)}</dt><dd>${renderValue(rel.content, escape)}</dd></div>`;
    }).join('')}</dl></section>` : '');
}
