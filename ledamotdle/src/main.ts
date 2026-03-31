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
  const res = await fetch("/ledamoter.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ledamoter.json: ${res.status}`);
  const data = (await res.json()) as Ledamot[];
  return data.filter((m) => m?.id && m?.party && m?.imageLocal);
}

function mountLayout(root: HTMLElement) {
  root.innerHTML = `
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="min-h-screen flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-md">
        <div class="w-full max-w-md px-4 py-0 space-y-6">
          <div class="flex items-baseline justify-between">
            <div class="text-sm text-slate-300 flex flex-col">
              <div> Score: <span id="score" class="font-semibold tabular-nums">0</span></div>
              <div> Accuracy: <span id="accuracy" class="font-semibold tabular-nums">0</span></div>
            </div>
            <h1 class="text-3xl font-semibold tracking-tight">Ledamotdle</h1>
            <div class="text-sm text-slate-300">
              <div> Streak: <span id="streak" class="font-semibold tabular-nums">0</span></div>
              <div> Best: <span id="best-streak" class="font-semibold tabular-nums">0</span></div>
            </div>
          </div>

          <div id="status" class="mt-2 text-sm text-slate-300">Laddar…</div>

          <div class="mt-5">
            <div class="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-slate-800">
              <img id="photo" alt="Ledamot" class="w-full h-auto block select-none" draggable="false" />
            </div>

            <div class="mt-3 space-y-1">
              <div id="reveal" class="text-base text-slate-200 font-semibold"></div>
              <div id="credit" class="text-xs text-slate-400"></div>
            </div>

            <div id="feedback" class="mt-4 text-sm"></div>
          </div>

          <div class="mt-6">
            <div id="choices" class="grid grid-cols-2 sm:grid-cols-3 gap-3"></div>
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
          <div class="mt-4 text-xs text-slate-500 text-right">
            Skapad av <a href="https://www.linkedin.com/in/erik--risberg/" target="_blank" class="hover:text-slate-300 underline">Erik Risberg</a>
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
  const members = await loadMembers();

  if (members.length === 0) {
    status.textContent = "Found no ledamoter.json.";
    return;
  }

  const parties = uniqueParties(members);
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

  function setScore() {
    scoreEl.textContent = String(score) + "/" + String(total);
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
  
  function pickNext(): Ledamot {
    const remaining = members.filter((m) => !used.has(m.id));
    if (remaining.length === 0) used.clear();
    const pick = sample(remaining.length ? remaining : members);
    used.add(pick.id);
    return pick;
  }

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
        ? `<img src="/images/partier/${PARTY_LOGOS[p]}.png" alt="${p}" class="w-6 h-6 object-contain" />
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
    current = pickNext();
    photo.src = current.imageLocal;
    status.textContent = "";
    feedback.textContent = "";
    feedback.className = "mt-4 text-sm"
    reveal.textContent = current.namn;
    photo.src = current.imageLocal;
    
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
    const text = `🏛️ Ledamotdle\nPoäng: ${score}/${total}\nRätt: ${accuracy + "%"}\nBest Streak: ${bestStreak}
    \n Ledamotdle.se`;
    navigator.clipboard.writeText(text).then(() => {
      shareBtn.textContent = "Kopierat!";
      setTimeout(() => shareBtn.textContent = "Dela 📤", 2000);
    });
  })


  renderPartyButtons();
  setScore();
  nextRound();
}

main().catch((err) => {
  console.error(err);
  const root = document.getElementById("app");
  if (root) root.textContent = "Error check console.";
});