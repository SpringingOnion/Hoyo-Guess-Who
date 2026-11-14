// Builds src/data/roster.json and downloads official character icons into
// public/portraits/<game>/<id>.webp so the app works fully offline.
//
//   npm run roster            (skips portraits already downloaded)
//   npm run roster -- --force (re-downloads everything)
//
// Sources:
//   Genshin Impact  - https://gi.yatta.moe   (Project Amber / Yatta)
//   Honkai Star Rail- https://sr.yatta.moe
//   Zenless Zone Zero - EnkaNetwork/API-docs store + https://enka.network/ui

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(ROOT, 'src/data/roster.json');
const OUT_IMG = path.join(ROOT, 'public/portraits');
const OVERRIDES = path.join(ROOT, 'data/overrides.json');
const FORCE = process.argv.includes('--force');
const SIZE = 192;
const UA = { 'User-Agent': 'hoyo-guess-who-roster-builder' };
const NOW = Date.now() / 1000;

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const clean = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- Genshin
const GI_ELEMENT = { Fire: 'Pyro', Water: 'Hydro', Wind: 'Anemo', Electric: 'Electro', Grass: 'Dendro', Ice: 'Cryo', Rock: 'Geo' };
const GI_REGION = {
  MONDSTADT: 'Mondstadt', LIYUE: 'Liyue', INAZUMA: 'Inazuma', SUMERU: 'Sumeru', FONTAINE: 'Fontaine',
  NATLAN: 'Natlan', NODKRAI: 'Nod-Krai', NODKRAI_ZIBAI: 'Nod-Krai', SNEZHNAYA: 'Snezhnaya',
  SNEZHNAYA_STAR: 'Snezhnaya', FATUI: 'Snezhnaya',
};
const GI_GENDER = { BOY: 'Male', MALE: 'Male', GIRL: 'Female', LADY: 'Female', LOLI: 'Female' };

async function genshin() {
  const { data } = await getJson('https://gi.yatta.moe/api/v2/en/avatar');
  const out = [];
  for (const [key, c] of Object.entries(data.items)) {
    if (c.release > NOW) continue; // unreleased
    let name = clean(c.name);
    const isTraveler = key.startsWith('10000005') || key.startsWith('10000007');
    if (isTraveler) {
      if (!key.endsWith('-anemo')) continue; // one entry per twin
      name = key.startsWith('10000005') ? 'Aether' : 'Lumine';
    } else if (!c.element || c.element === 'None') continue; // Manekin(a), test entries
    out.push({
      id: `gi-${key.replace(/-anemo$/, '')}`,
      name,
      rarity: c.rank >= 5 ? 5 : 4,
      attrs: {
        gender: GI_GENDER[c.bodyType],
        element: isTraveler ? undefined : GI_ELEMENT[c.element],
        weapon: data.types[c.weaponType] ?? c.weaponType,
        region: isTraveler ? 'Other' : GI_REGION[c.region] ?? 'Other',
      },
      src: `https://gi.yatta.moe/assets/UI/${c.icon}.png`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- Star Rail
const SR_PATH = {
  Warrior: 'Destruction', Rogue: 'The Hunt', Mage: 'Erudition', Shaman: 'Harmony', Warlock: 'Nihility',
  Knight: 'Preservation', Priest: 'Abundance', Memory: 'Remembrance', Elation: 'Elation',
};
const SR_TYPE = { Thunder: 'Lightning' };

async function starRail() {
  const { data } = await getJson('https://sr.yatta.moe/api/v2/en/avatar');
  const out = [];
  for (const [key, c] of Object.entries(data.items)) {
    if (c.release > NOW) continue;
    const id = Number(key);
    const isTrailblazer = id >= 8000;
    if (isTrailblazer && id !== 8001 && id !== 8002) continue; // one per gender
    let name = clean(c.name);
    if (isTrailblazer) name = id === 8001 ? 'Caelus' : 'Stelle';
    // March 7th has two versions; keep them distinguishable.
    if (id === 1224) name = 'March 7th (Hunt)';
    out.push({
      id: `hsr-${key}`,
      name,
      rarity: c.rank >= 5 ? 5 : 4,
      attrs: {
        gender: isTrailblazer ? (id === 8001 ? 'Male' : 'Female') : undefined, // rest from overrides
        element: isTrailblazer ? undefined : SR_TYPE[c.types.combatType] ?? c.types.combatType,
        path: isTrailblazer ? undefined : SR_PATH[c.types.pathType] ?? c.types.pathType,
      },
      src: `https://sr.yatta.moe/hsr/assets/UI/avatar/${c.icon}.png`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- Zenless
const ZZZ_ELEMENT = { Elec: 'Electric', Physics: 'Physical', Fire: 'Fire', Ice: 'Ice', Ether: 'Ether', Wind: 'Wind', Lumen: 'Lumen' };

async function zenless() {
  const base = 'https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz';
  const [avatars, locs] = await Promise.all([getJson(`${base}/avatars.json`), getJson(`${base}/locs.json`)]);
  const en = locs.en;
  const out = [];
  for (const [key, c] of Object.entries(avatars)) {
    const name = en[c.Name];
    if (!name) continue;
    const element = c.ElementTypes.map((e) => ZZZ_ELEMENT[e]).find(Boolean);
    out.push({
      id: `zzz-${key}`,
      name: clean(name),
      rarity: c.Rarity >= 4 ? 5 : 4, // S-rank -> 5, A-rank -> 4
      attrs: {
        gender: c.Name.includes('_Female_') ? 'Female' : c.Name.includes('_Male_') ? 'Male' : undefined,
        element,
        specialty: c.ProfessionType,
      },
      src: `https://enka.network${c.CircleIcon}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------- images
async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function downloadPortrait(game, ch) {
  const file = path.join(OUT_IMG, game, `${ch.id}.webp`);
  if (!FORCE && (await exists(file))) return true;
  try {
    const res = await fetch(ch.src, { headers: UA });
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize(SIZE, SIZE, { fit: 'cover', position: 'top' })
      .webp({ quality: 82 })
      .toFile(file);
    return true;
  } catch (e) {
    console.warn(`  ! portrait failed for ${ch.name}: ${e.message}`);
    return false;
  }
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]); }
  }));
  return results;
}

// ---------------------------------------------------------------- main
const OUT_META = path.join(ROOT, 'src/data/meta.json');
const readJson = async (p, fallback) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return fallback; } };

const overrides = await readJson(OVERRIDES, {});
const previous = await readJson(OUT_JSON, {});
const roster = {};
let failed = false;

for (const [game, load] of [['gi', genshin], ['hsr', starRail], ['zzz', zenless]]) {
  console.log(`Fetching ${game}...`);
  let chars;
  try {
    chars = await load();
  } catch (e) {
    // A source being down shouldn't wipe out that game's characters.
    console.warn(`  ! ${game} source failed (${e.message}); keeping the previous list`);
    roster[game] = previous[game] ?? [];
    failed = true;
    continue;
  }
  const dir = path.join(OUT_IMG, game);
  await fs.mkdir(dir, { recursive: true });
  const ok = await pool(chars, 6, (c) => downloadPortrait(game, c));
  roster[game] = chars
    .filter((_, i) => ok[i])
    .map(({ src, ...c }) => {
      const { _comment, name, rarity, ...attrOverrides } = overrides[c.id] ?? {};
      const attrs = { ...c.attrs, ...attrOverrides };
      for (const k of Object.keys(attrs)) if (attrs[k] == null) delete attrs[k];
      return { ...c, name: name ?? c.name, rarity: rarity ?? c.rarity, attrs, img: `portraits/${game}/${c.id}.webp` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Report changes and tidy up portraits of characters that no longer exist.
  const before = new Set((previous[game] ?? []).map((c) => c.id));
  const now = new Set(roster[game].map((c) => c.id));
  const added = roster[game].filter((c) => !before.has(c.id));
  const removed = (previous[game] ?? []).filter((c) => !now.has(c.id));
  for (const f of await fs.readdir(dir)) if (!now.has(f.replace(/\.webp$/, ''))) await fs.rm(path.join(dir, f));
  console.log(`  ${roster[game].length} characters`);
  if (before.size && added.length) console.log(`  + new: ${added.map((c) => c.name).join(', ')}`);
  if (removed.length) console.log(`  - removed: ${removed.map((c) => c.name).join(', ')}`);
  const noGender = added.filter((c) => !c.attrs.gender);
  if (before.size && noGender.length) console.log(`  ? no gender (add to data/overrides.json): ${noGender.map((c) => `${c.id} ${c.name}`).join(', ')}`);
}

const json = JSON.stringify(roster, null, 1);
const changed = json !== JSON.stringify(previous, null, 1);
await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
if (changed || !(await exists(OUT_META))) {
  await fs.writeFile(OUT_JSON, json);
  const counts = Object.fromEntries(Object.entries(roster).map(([g, l]) => [g, l.length]));
  await fs.writeFile(OUT_META, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), counts }, null, 1) + '\n');
  console.log(changed ? 'Character list updated.' : 'Wrote meta.json.');
} else {
  console.log('No changes, already up to date.');
}
if (failed) process.exitCode = 1;
