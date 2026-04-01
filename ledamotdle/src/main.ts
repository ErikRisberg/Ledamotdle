import './style.css'
import type { Ledamot } from './types'


const CORRECT_CLASSES = ["ring-2", "ring-emerald-400", "bg-emerald-500/20"];
const WRONG_CLASSES = ["ring-2", "ring-rose-400", "bg-rose-500/20"];
const RESET_CLASSES = ["ring-2", "ring-1", "ring-emerald-400", "bg-emerald-500/20", "ring-rose-400", "bg-rose-500/20", "ring-white/10"];


const PARTY_LABELS: Record<string, string> = {
  S: "Socialdemokraterna",
  M: "Moderaterna",
  SD: "Sverigedemokraterna",
  C: "Centerpartiet",
  V: "Vänsterpartiet",
  KD: "Kristdemokraterna",
  MP: "Miljöpartiet",
  L: "Liberalerna",
  "-": "Oberoende"
}

const PARTY_LOGOS: Record<string, string> = {
  S: "s_logo",
  M: "m_logo",
  SD: "sd_logo",
  C: "c_logo",
  V: "v_logo",
  KD: "kd_logo",
  MP: "mp_logo",
  L: "l_logo",
}


function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueParties(members: Ledamot[]): string[] {
  return [...new Set(members.map((m) => m.party))];
}

async function loadMembers(): Promise<Ledamot[]> {
  // Allow normal HTTP caching for this static JSON; avoids re-downloading on every page load.
  const res = await fetch("/ledamoter.json");
  if (!res.ok) throw new Error(`Failed to load ledamoter.json: ${res.status}`);
  const data = (await res.json()) as Ledamot[];
  return data.filter((m) => m?.id && m?.party && m?.imageLocal);
}

function mountLayout(root: HTMLElement) {
  root.innerHTML = `
  <div id="menu" class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
    <div class="text-center space-y-8">
      <div class="space-y-2">
        <h1 class="text-4xl font-semibold tracking-tight">Ledamotdle</h1>
        <p class="text-slate-400 text-xl">Gissa vilket parti riksdagsledamoten tillhör!</p>
      </div>
      <div class="space-y-8">
        <div class="space-y-1">
          <button id="btn-daily" class="w-64 rounded-xl px-6 py-4 text-sm font-semibold bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 block mx-auto">
            📅 Daily
          </button>
          <p class="text-base text-slate-500">10 ledamöter — byts om <span id="menu-timer" class="tabular-nums"></span></p>
        </div>
        <div class="space-y-1">
          <button id="btn-endless" class="w-64 rounded-xl px-6 py-4 text-sm font-semibold bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 block mx-auto">
            ♾️ Endless
          </button>
          <p class="text-base text-slate-500">Behöver jag ens förklara den här?</p>
        </div>
      </div>
    </div>
    <div class="absolute bottom-3 right-4 text-xs text-slate-500">
      Skapad av <a href="https://www.linkedin.com/in/erik--risberg/" target="_blank" class="hover:text-slate-300 underline">Erik Risberg</a>
    </div>
  </div>
<div id="game" class="hidden">
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="min-h-screen flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="w-full max-w-md px-4 py-0 space-y-6">
          <div class="flex items-baseline justify-between">
            <div class="text-sm text-slate-300 flex flex-col">
              <div> Rätt: <span id="score" class="font-semibold tabular-nums">0</span></div>
              <div> <span id="accuracy" class="font-semibold tabular-nums">0</span></div>
            </div>

            <h1 class="text-3xl font-semibold tracking-tight">Ledamotdle</h1>
            <div class="text-sm text-slate-300">
              <div> Streak: <span id="streak" class="font-semibold tabular-nums">0</span></div>
              <div> Best: <span id="best-streak" class="font-semibold tabular-nums">0</span></div>
            </div>
          </div>
          <div id="mode-label" class="text-lg text-slate-400 text-center -mt-11"></div>
          <div id="status" class="mt-2 text-sm text-slate-300 min-h-5">&nbsp;</div>
          <div class="-mt-15">
            <div class="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-800">
              <img id="photo" alt="Ledamot" width="1641" height="2188" class="w-full h-auto block select-none" draggable="false" loading="eager" decoding="async" fetchpriority="high" />
            </div>

            <div class="mt-3 space-y-1">
              <div id="reveal" class="text-base text-slate-200 font-semibold"></div>
              <div id="credit" class="text-xs text-slate-400"></div>
            </div>

            <div id="feedback" class="mt-4 text-sm"></div>
          </div>

          <div class="-mt-3">
            <div id="choices" class="grid grid-cols-2 sm:grid-cols-3 gap-3"></div>
          </div>

          <div id="end-screen" class="hidden text-center space-y-6 py-10">
            <h2 class="text-2xl font-semibold">Daily klar! 🎉</h2>
            <p class="text-slate-300">Du fick <span id="end-score" class="font-bold text-white"></span> rätt av 10</p>
            <p class="text-slate-300">Bästa streak: <span id="end-streak" class="font-bold text-white"></span></p>
            <div class="text-slate-400 text-sm">
              Nästa daily om <span id="daily-timer" class="font-semibold text-white tabular-nums"></span>
            </div>
            <button id="end-share"
              class="rounded-xl px-6 py-3 text-sm font-semibold bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10">
              Dela resultat 📤
            </button>
          </div>

          <div class="mt-5 flex items-center justify-between">
            <button id="reset"
              class="rounded-xl px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10">
              Reset
            </button>

            <button id="share"
              class="rounded-xl px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10">
              Dela 📤
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `;
}

async function main() {
  const root = el<HTMLElement>("app");
  
  mountLayout(root);
  const status = el<HTMLDivElement>("status");
  const photo = el<HTMLImageElement>("photo");
  const reveal = el<HTMLDivElement>("reveal");
  const feedback = el<HTMLDivElement>("feedback");
  const choices = el<HTMLDivElement>("choices");
  const scoreEl = el<HTMLSpanElement>("score");
  const resetBtn = el<HTMLButtonElement>("reset");
  const shareBtn = el<HTMLButtonElement>("share");
  const membersPromise = loadMembers();

  let members: Ledamot[] = [];
  let parties: string[] = [];
  let current: Ledamot | null = null;
  let locked = false;
  const accuracyEl = el<HTMLSpanElement>("accuracy");
  const streakEl = el<HTMLSpanElement>("streak");
  const bestStreakEl = el<HTMLSpanElement>("best-streak");
  let score = 0;
  let total = 0;
  let streak = 0;
  let bestStreak = 0;
  let accuracy = 0;
  const used = new Set<string>();
  let nextTimer: number | null = null;
  let mode: "daily" | "endless" = "endless";
  let dailyMembers: Ledamot[] = [];
  let dailyIndex = 0;
  let currentDailyIndex: number | null = null;
  let dailyResults: boolean[] = [];

  type UpcomingEntry = { member: Ledamot; dailyIndex: number | null };
  const upcoming: UpcomingEntry[] = [];
  const preloaded = new Set<string>();
  const inflight = new Map<string, Promise<void>>();

  const menu = el<HTMLDivElement>("menu");
  const game = el<HTMLDivElement>("game");
  const btnDaily = el<HTMLButtonElement>("btn-daily");
  const btnEndless = el<HTMLButtonElement>("btn-endless");
  const endScreen = el<HTMLDivElement>("end-screen");
  const endScore = el<HTMLSpanElement>("end-score");
  const endStreak = el<HTMLSpanElement>("end-streak");
  const endShareBtn = el<HTMLButtonElement>("end-share");



  function startDailyTimer() {
    const timerEl = el<HTMLSpanElement>("daily-timer");
    const menuTimerEl = document.getElementById("menu-timer") as HTMLSpanElement;

    function update() {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();

      const h = Math.floor(diff / 1000 / 60 / 60);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);

      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      timerEl.textContent = timeStr;
      if (menuTimerEl) menuTimerEl.textContent = timeStr;
    }

    update();
    setInterval(update, 1000);
  }


  function randomSeed(sneed: number) {
    let s = sneed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  function getDailyMembers(members: Ledamot[], count = 10): Ledamot[] {
    const today = new Date();
    const sneed = today.getFullYear() * 10000 + (today.getMonth() +1) * 100 + today.getDate();
    const rng = randomSeed(sneed);
    const shuffled = [...members].sort(() => rng() - 0.5);
    return shuffled.slice(0,count);
  }


  function setScore() {
    scoreEl.textContent = mode === "daily"
      ? String(score) + "/10"
      : String(score) + "/" + String(total);
    
    streakEl.textContent = String(streak);
    bestStreakEl.textContent = String(bestStreak);
    if (total == 0) {
      accuracy = 0;
      accuracyEl.textContent = accuracy + "%";
    } else {
      accuracy = Math.round((score/total) * 100);
      accuracyEl.textContent = accuracy + "%";
    }
  }

  function clearTimer() {
    if (nextTimer !== null) {
      window.clearTimeout(nextTimer);
      nextTimer = null;
    }
  }
  
  function pickNext(): UpcomingEntry | null {
    if (mode == "daily") {
      if (dailyIndex >= dailyMembers.length) return null;
      const idx = dailyIndex++;
      return { member: dailyMembers[idx], dailyIndex: idx };
    }

    const remaining = members.filter((m) => !used.has(m.id));
    if (remaining.length === 0) used.clear();
    const pick = sample(remaining.length ? remaining : members);
    used.add(pick.id);
    return { member: pick, dailyIndex: null };
  }

  function preloadImage(url: string | undefined | null): Promise<void> {
    if (!url) return Promise.resolve();
    if (preloaded.has(url)) return Promise.resolve();
    const existing = inflight.get(url);
    if (existing) return existing;

    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = async () => {
        try {
          await (img.decode?.() ?? Promise.resolve());
        } catch {
        }
        preloaded.add(url);
        inflight.delete(url);
        resolve();
      };
      img.onerror = () => {
        inflight.delete(url);
        resolve();
      };
      img.src = url;
    });

    inflight.set(url, p);
    return p;
  }

  function ensureUpcoming(minCount = 2) {
    while (upcoming.length < minCount) {
      const next = pickNext();
      if (!next) break;
      upcoming.push(next);
    }
  }

  function takeUpcoming(): UpcomingEntry | null {
    ensureUpcoming(1);
    return upcoming.shift() ?? null;
  }

  function peekUpcoming(): UpcomingEntry | null {
    ensureUpcoming(1);
    return upcoming[0] ?? null;
  }

  function preloadRoundAssets(currentMember: Ledamot | null) {
    const nextMember = peekUpcoming()?.member ?? null;
    void preloadImage(currentMember?.imageLocal);
    void preloadImage(nextMember?.imageLocal);
  }

  function preloadPartyLogos() {
    const urls = Object.values(PARTY_LOGOS).map((name) => `/images/partier/${name}.png`);
    for (const url of urls) void preloadImage(url);
  }

  preloadPartyLogos();

  members = await membersPromise;

  if (members.length === 0) {
    status.textContent = "Found no ledamoter.json.";
    return;
  }

  parties = uniqueParties(members);

  function renderPartyButtons() {
    choices.innerHTML = "";
    for (const p of parties) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.party = p;
      btn.className =
        "rounded-xl px-3 py-3 text-sm font-semibold " +
        "bg-slate-800 hover:bg-slate-700 ring-1 ring-white/10 " +
        "transition focus:outline-none flex items-center justify-center gap-1";
      btn.innerHTML = PARTY_LOGOS[p]
        ? `<img src="/images/partier/${PARTY_LOGOS[p]}.png" alt="${p}" class="w-6 h-6 object-contain" loading="eager" decoding="async" />
          <span>${p}</span>`
        : `<span>${PARTY_LABELS[p] ?? p}</span>`;

      btn.addEventListener("click", () => choose(p));
      choices.appendChild(btn);
    }
  }

  function setButtonsDisabled(disabled: boolean) {
    const btns = [...choices.querySelectorAll("button")] as HTMLButtonElement[];
    btns.forEach((b) => {
      if (disabled) b.classList.add("opacity-70", "cursor-not-allowed", "pointer-events-none");
      else b.classList.remove("opacity-70", "cursor-not-allowed", "pointer-events-none");
    });
  }

  function markButtons(chosen: string, correct: string) {
    const btns = [...choices.querySelectorAll("button")] as HTMLButtonElement[];

    btns.forEach((b) => {
      const p = b.dataset.party!;
      b.classList.remove(...RESET_CLASSES);
      if (p === correct) b.classList.add(...CORRECT_CLASSES);
      if (p === chosen && chosen !== correct) b.classList.add(...WRONG_CLASSES);
    });
  }

  function nextRound() {
    clearTimer();
    locked = false;

    const resetBtn = el<HTMLButtonElement>("reset");
    const shareBtn = el<HTMLButtonElement>("share");

    if (mode === "daily") {
      resetBtn.classList.add("hidden");
      shareBtn.classList.add("hidden");
    } else {
      resetBtn.classList.remove("hidden");
      shareBtn.classList.remove("hidden");
    }

    const next = takeUpcoming();

    if (!next) {
      el<HTMLDivElement>("choices").classList.add("hidden");
      el<HTMLImageElement>("photo").classList.add("hidden");
      el<HTMLDivElement>("feedback").classList.add("hidden");
      el<HTMLDivElement>("reveal").classList.add("hidden");
      endScreen.classList.remove("hidden");

      endScore.textContent = String(score);
      endStreak.textContent = String(bestStreak);
      return;
    }

    current = next.member;
    currentDailyIndex = next.dailyIndex;
    status.textContent = "\u00A0";
    photo.onload = () => {
      status.textContent = "\u00A0";
    };
    photo.onerror = () => {
      status.textContent = "Kunde inte ladda bilden";
    };
    photo.src = current.imageLocal;
    feedback.textContent = "";
    feedback.className = "mt-4 text-sm"
    reveal.textContent = current.namn;
    ensureUpcoming(2);
    preloadRoundAssets(current);
    
    setButtonsDisabled(false);
    renderPartyButtons();
  }

  function choose(party: string) {
    if (locked || !current) return;
    locked = true;
    total += 1;
    markButtons(party, current.party);
    setButtonsDisabled(true);
    reveal.textContent = `${current.namn} — ${PARTY_LABELS[current.party] ?? current.party}`;
    
    const correct = party === current.party;
    if (mode === "daily" && currentDailyIndex !== null) {
      dailyResults[currentDailyIndex] = correct;
    }
    if (correct) {
      score += 1;
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
      setScore();
    } else {
      streak = 0;
      setScore();
    }

    clearTimer();
    nextTimer = window.setTimeout(() => nextRound(), 2000);
  }

  resetBtn.addEventListener("click", () => {
    clearTimer();
    score = 0;
    total = 0;
    streak = 0;
    used.clear();
    setScore();
    nextRound();
  });

  shareBtn.addEventListener("click", () => {
    const text = `🏛️ Ledamotdle\nRätt: ${score}/${total} ${accuracy + "%"}\nBest Streak: ${bestStreak}
    \n  https://ledamotdle.se/`;
    navigator.clipboard.writeText(text).then(() => {
      shareBtn.textContent = "Kopierat!";
      setTimeout(() => shareBtn.textContent = "Dela 📤", 2000);
    });
  })

  btnDaily.addEventListener("click", () => {
    mode = "daily";
    dailyMembers = getDailyMembers(members);
    dailyIndex = 0;
    currentDailyIndex = null;
    dailyResults = new Array(10).fill(false);
    upcoming.length = 0;
    el<HTMLDivElement>("mode-label").textContent = "Daily";
    menu.classList.add("hidden");
    game.classList.remove("hidden");
    setScore();
    preloadPartyLogos();
    ensureUpcoming(2);
    preloadRoundAssets(peekUpcoming()?.member ?? null);
    nextRound();
  });

  btnEndless.addEventListener("click", () => {
    mode="endless";
    upcoming.length = 0;
    el<HTMLDivElement>("mode-label").textContent = "Endless";
    menu.classList.add("hidden");
    game.classList.remove("hidden");
    preloadPartyLogos();
    ensureUpcoming(2);
    preloadRoundAssets(peekUpcoming()?.member ?? null);
    nextRound();
  });


  endShareBtn.addEventListener("click", () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("sv-SE");
    const emoji = Array.from({ length: 10 }, (_, i) => (dailyResults[i] ? "🟩" : "🟥")).join("");
    const text = `🏛️ Ledamotdle Daily ${dateStr}\n${score}/10\n${emoji}\n  https://ledamotdle.se/`;
    
    navigator.clipboard.writeText(text).then(() => {
      endShareBtn.textContent = "Kopierat! ✅";
      setTimeout(() => endShareBtn.textContent = "Dela resultat 📤", 2000);
    });
  });

  startDailyTimer();
}

main().catch((err) => {
  console.error(err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Error check console.";
});