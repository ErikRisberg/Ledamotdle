// download-images.mjs
import fs from "node:fs/promises";
import path from "node:path";

const LIST_URL =
  "https://data.riksdagen.se/personlista/?iid=&fnamn=&enamn=&f_ar=&kn=&parti=&valkrets=&rdlstatus=&org=&utformat=json&sort=sorteringsnamn&sortorder=asc&termlista=";

const OUT_DIR = "./public/images/ledamot";
const OUT_JSON = "./public/ledamoter.json";

const CONCURRENCY = 6;

const imageUrlMaxFromUuid = (uuid) =>
  `https://data.riksdagen.se/filarkiv/bilder/ledamot/${uuid}_max.jpg`;

function asArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithRetry(url, tries = 6) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "ledamot-quiz/1.0" } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(400 * Math.pow(2, i));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} för ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await sleep(250 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadFileWithRetry(url, filepath, tries = 6) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "ledamot-quiz/1.0" } });

      if (res.status === 429 || res.status >= 500) {
        await sleep(400 * Math.pow(2, i));
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} vid bild: ${url}`);

      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(filepath, buf);
      return true;
    } catch (e) {
      lastErr = e;
      await sleep(250 * Math.pow(2, i));
    }
  }
  // 404/annat: vi räknar som misslyckad
  // (Du kan logga lastErr om du vill.)
  return false;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

function normalizeName(p) {
  const fn = (p?.tilltalsnamn || p?.fornamn || "").trim();
  const en = (p?.efternamn || "").trim();
  return `${fn} ${en}`.trim();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir("./public", { recursive: true });

  // 1) Hämta listan (349)
  const listData = await fetchJsonWithRetry(LIST_URL);
  const people = asArray(listData?.personlista?.person);

  console.log(`Personer i listan: ${people.length}`);
  if (people.length === 0) process.exit(1);

  // 2) Bygg baslista (sourceid + namn + parti)
  const basics = people
    .map((p) => {
      const sourceid = (p.sourceid || "").trim(); // UUID för filarkivet
      const namn = normalizeName(p);
      const party = (p.parti || "").trim();
      if (!sourceid || !namn || !party) return null;
      return { sourceid, namn, party };
    })
    .filter(Boolean);

  console.log(`Basics efter filtrering: ${basics.length}`);

  let ok = 0;
  let missing = 0;

  const out = (await mapLimit(basics, CONCURRENCY, async (p) => {
    const imageUrlMax = imageUrlMaxFromUuid(p.sourceid);

    const localFile = `${p.sourceid}.jpg`;
    const localPath = path.join(OUT_DIR, localFile);

    if (!(await fileExists(localPath))) {
      const success = await downloadFileWithRetry(imageUrlMax, localPath);
      if (!success) {
        missing++;
        return null;
      }
    }

    ok++;
    return {
      id: p.sourceid,
      namn: p.namn,
      party: p.party,
      imageLocal: `/images/ledamot/${localFile}`,
      imageUrlMax,
      credit: "Foto: Sveriges riksdag",
    };
  })).filter(Boolean);

  await fs.writeFile(OUT_JSON, JSON.stringify(out, null, 2), "utf8");

  console.log(`Klart! ${out.length} poster i ${OUT_JSON}`);
  console.log(`Bilder i ${OUT_DIR}`);
  console.log(`Lyckade: ${ok}`);
  console.log(`Saknade bilder (t.ex. 404): ${missing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
