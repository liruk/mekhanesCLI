import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { createDatabase } from './schema';

const SETTINGS_ROOT = path.join(__dirname, '..', '..', 'settings');

interface CharacterYaml {
  name: string;
  reading?: string;
  aliases?: string[];
  profile?: {
    appearance?: string;
    personality?: string;
    age?: string;
    age_detail?: string;
    ability?: Array<{ [key: string]: string } | string>;
    sex?: {
      body?: string;
      identity?: string;
      target?: string;
      detail?: string;
    };
  };
  status?: {
    [category: string]: {
      value?: string | number;
      detail?: string;
      taste?: string;
    };
  };
  background?: string;
  relations?: Array<{
    target: string;
    content: string;
  }>;
  misc?: { [key: string]: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAbility(ability: unknown): { name: string; detail: string } {
  if (typeof ability === 'string') {
    return { name: ability, detail: '' };
  }
  if (!isRecord(ability)) {
    return { name: String(ability ?? ''), detail: '' };
  }
  if (typeof ability.name === 'string') {
    return {
      name: ability.name,
      detail: normalizeText(ability.detail ?? ability.rank) ?? '',
    };
  }
  const [name, detail] = Object.entries(ability)[0] ?? ['', ''];
  return { name, detail: normalizeText(detail) ?? '' };
}

function collectYamlFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectYamlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name === 'profile.yaml') {
      files.push(fullPath);
    }
  }

  return files;
}

function getCharacterYamlFiles(): string[] {
  const worldDirs = fs.readdirSync(SETTINGS_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(SETTINGS_ROOT, entry.name));

  return worldDirs.flatMap(collectYamlFiles).sort();
}

function normalizeText(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value.map(item => {
      const rendered = normalizeText(item) ?? '';
      return rendered.includes('\n') ? `- ${rendered.replace(/\n/g, '\n  ')}` : `- ${rendered}`;
    }).join('\n');
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => {
      const rendered = normalizeText(item) ?? '';
      if (rendered.includes('\n')) {
        return `- ${key}:\n${rendered.split('\n').map(line => `  ${line}`).join('\n')}`;
      }
      return `- ${key}: ${rendered}`;
    }).join('\n');
  }
  if (typeof value === 'string') {
    return value;
  }
  return value == null ? null : String(value);
}

function parseNullableInt(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function convertYamlToDb() {
  const db = createDatabase();
  
  const clearStmt = db.transaction(() => {
    db.exec('DELETE FROM misc');
    db.exec('DELETE FROM status');
    db.exec('DELETE FROM aliases');
    db.exec('DELETE FROM relations');
    db.exec('DELETE FROM abilities');
    db.exec('DELETE FROM characters');
  });
  clearStmt();

  const insertCharacter = db.prepare(`
    INSERT INTO characters (name, reading, appearance, personality, age, age_detail, background, sex_body, sex_identity, sex_target, sex_detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAbility = db.prepare(`
    INSERT INTO abilities (character_name, ability_name, ability_detail)
    VALUES (?, ?, ?)
  `);

  const insertRelation = db.prepare(`
    INSERT INTO relations (character_name, target_name, content)
    VALUES (?, ?, ?)
  `);

  const insertAlias = db.prepare(`
    INSERT INTO aliases (character_name, alias)
    VALUES (?, ?)
  `);

  const insertStatus = db.prepare(`
    INSERT INTO status (character_name, category, value, detail, taste)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMisc = db.prepare(`
    INSERT INTO misc (character_name, key, value)
    VALUES (?, ?, ?)
  `);

  const files = getCharacterYamlFiles();
  
  const insertAll = db.transaction((characters: CharacterYaml[]) => {
    for (const char of characters) {
      const profile = char.profile || {};
      const sex = isRecord(profile.sex) ? profile.sex : {};
      
      insertCharacter.run(
        char.name,
        char.reading || null,
        normalizeText(profile.appearance),
        normalizeText(profile.personality),
        normalizeText(profile.age),
        normalizeText(profile.age_detail),
        normalizeText(char.background),
        normalizeText(sex.body),
        normalizeText(sex.identity),
        normalizeText(sex.target),
        normalizeText(sex.detail)
      );

      if (Array.isArray(char.aliases)) {
        for (const alias of char.aliases) {
          insertAlias.run(char.name, normalizeText(alias));
        }
      }

      if (Array.isArray(profile.ability)) {
        for (const ability of profile.ability) {
          const { name, detail } = parseAbility(ability);
          insertAbility.run(char.name, name, detail);
        }
      }

      if (Array.isArray(char.relations)) {
        for (const rel of char.relations) {
          if (isRecord(rel)) {
            insertRelation.run(char.name, normalizeText(rel.target), normalizeText(rel.content));
          }
        }
      }

      if (isRecord(char.status)) {
        for (const [category, data] of Object.entries(char.status)) {
          const statusData = isRecord(data) ? data : { value: data };
          insertStatus.run(
            char.name,
            category,
            parseNullableInt(statusData.value),
            normalizeText(statusData.detail),
            normalizeText(statusData.taste)
          );
        }
      }

      if (isRecord(char.misc)) {
        for (const [key, value] of Object.entries(char.misc)) {
          if (key !== 'MD_Relations') {
            insertMisc.run(char.name, key, normalizeText(value));
          }
        }
      }
    }
  });

  const characters: CharacterYaml[] = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const char = yaml.load(content) as CharacterYaml;
    characters.push(char);
  }

  insertAll(characters);
  
  console.log(`Converted ${characters.length} characters to database.`);
  db.close();
}

convertYamlToDb();
