import { useEffect, useRef, useState } from "react";
import { Engine, loadSave, writeSave, type FighterId, type SaveData, type Snapshot } from "@/game/engine";
import { fighterOf, ROSTER } from "@/game/roster";
import { isMuted, setMuted, startMusic, stopMusic, sfx, unlockAudio } from "@/game/audio";

type Screen = "title" | "select" | "fight";

export function NinthGate() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const savedRef = useRef(false);
  const [screen, setScreen] = useState<Screen>("title");
  const [pick, setPick] = useState<FighterId>("eatboss");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [muted, setMutedState] = useState(false);
  const [touch, setTouch] = useState(false);
  const [paused, setPaused] = useState(false);
  const [save, setSave] = useState<SaveData>(() =>
    typeof window === "undefined" ? { version: 1, wins: 0, games: 0 } : loadSave(),
  );
  const chosen = fighterOf(pick);

  function enterSelect() {
    try { unlockAudio(); startMusic(); sfx.ui(); } catch { /* ignore */ }
    setScreen("select");
  }
  function enterFight() {
    try { sfx.ui(); } catch { /* ignore */ }
    savedRef.current = false;
    engineRef.current?.start(pick);
    setScreen("fight");
  }

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas);
    engineRef.current = engine;
    engine.resize();
    const unsub = engine.subscribe((s: Snapshot) => {
      setSnap(s);
      setPaused(engine.paused);
    });
    const onResize = () => {
      engine.resize();
      setTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820);
    };
    window.addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        const btn = document.querySelector("[data-enter]") as HTMLButtonElement | null;
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    const ro = new ResizeObserver(onResize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      unsub();
      engine.destroy();
      stopMusic();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (snap?.phase !== "over" || savedRef.current) return;
    savedRef.current = true;
    const next = loadSave();
    next.games += 1;
    if (snap.outcome === "win") next.wins += 1;
    writeSave(next);
    setSave(next);
  }, [snap]);

  function hold(key: "left" | "right" | "jump" | "block" | "punch" | "kick" | "special" | "super", v: boolean) {
    engineRef.current?.setTouch({ [key]: v });
  }

  const fighting = screen === "fight" && snap && snap.phase !== "over";
  const p = snap?.p;
  const c = snap?.c;
  const specialLabel = pick === "eatboss" ? "Bite" : pick === "rosa" ? "Roll" : pick === "andrew" ? "Decree" : pick === "jayden" ? "Rush" : pick === "shen" ? "Lash" : pick === "spice" ? "Boom" : "Special";

  return (
    <div ref={wrapRef} className="relative h-dvh w-full overflow-hidden bg-bg text-fg" style={{ touchAction: screen === "fight" ? "none" : "manipulation" }}>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {screen === "title" && (
        <div
          className="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center bg-bg px-6 text-center"
          style={{ pointerEvents: "auto" }}
          onClick={enterSelect}
        >
          <p className="text-xs font-medium tracking-widest text-muted uppercase">Last city · night match</p>
          <h1 className="mt-3 font-display text-5xl font-medium tracking-tight sm:text-7xl">NINTH GATE</h1>
          <p className="mt-4 max-w-md text-sm text-muted">A street fight on the last rooftop. Best of three.</p>
          <p className="mt-6 text-xs text-muted">Wins {save.wins} · Matches {save.games}</p>
          <button
            type="button"
            data-enter
            onClick={(e) => { e.stopPropagation(); enterSelect(); }}
            className="mt-8 min-h-14 min-w-44 cursor-pointer rounded-xl bg-accent px-10 py-4 text-base font-medium text-accent-fg"
          >
            Enter
          </button>
          <p className="mt-4 text-xs text-muted">Tap anywhere to start</p>
        </div>
      )}

      {screen === "select" && (
        <div className="absolute inset-0 z-30 flex flex-col bg-bg/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5" style={{ pointerEvents: "auto" }}>
          <p className="text-center text-xs font-medium tracking-widest text-muted uppercase">Choose fighter</p>
          <h2 className="text-center font-display text-3xl font-medium">SELECT</h2>
          <p className="mt-1 text-center text-sm font-medium">{chosen.name}</p>
          <p className="text-center text-xs text-muted">{chosen.title}</p>
          <div className="mx-auto mt-3 grid w-full max-w-3xl flex-1 grid-cols-4 content-start gap-2 overflow-y-auto sm:grid-cols-5" style={{ touchAction: "pan-y" }}>
            {ROSTER.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPick(f.id)}
                className={`min-h-14 cursor-pointer overflow-hidden rounded-xl border text-left ${pick === f.id ? "border-accent bg-elevated ring-2 ring-accent" : "border-line bg-panel"}`}
              >
                <img src={`/portraits/${f.id}.jpg`} alt="" draggable={false} className="pointer-events-none aspect-[3/4] w-full object-cover object-top" />
                <div className="pointer-events-none px-1.5 py-1.5">
                  <div className="font-display text-[11px] uppercase leading-none sm:text-sm">{f.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted">{f.title}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={enterFight}
            className="mx-auto mt-3 mb-2 min-h-14 min-w-56 cursor-pointer rounded-xl bg-accent px-10 py-4 text-base font-medium text-accent-fg"
          >
            Fight as {chosen.name}
          </button>
        </div>
      )}

      {fighting && p && c && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <Bar name={p.name} hp={p.hp} meter={p.meter} accent={p.accent} flip={false} />
          <div className="flex flex-col items-center pt-1">
            <div className="font-display text-2xl tabular-nums">{Math.max(0, Math.ceil(snap.time))}</div>
            <div className="text-xs text-muted">R{snap.round}</div>
          </div>
          <Bar name={c.name} hp={c.hp} meter={c.meter} accent={c.accent} flip />
        </div>
      )}

      {fighting && snap.overlayT > 0 && snap.overlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="font-display text-5xl tracking-tight sm:text-7xl">{snap.overlay}</div>
        </div>
      )}

      {fighting && (
        <div className="pointer-events-none absolute right-3 top-20 flex gap-2 sm:right-5">
          <IconBtn label={muted ? "Sound" : "Mute"} onClick={() => { const n = !muted; setMuted(n); setMutedState(n); }} />
          <IconBtn label={paused ? "Resume" : "Pause"} onClick={() => { const e = engineRef.current; if (!e) return; e.paused = !e.paused; setPaused(e.paused); }} />
        </div>
      )}

      {paused && fighting && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/70">
          <div className="rounded-2xl border border-line bg-elevated p-6 text-center">
            <div className="font-display text-2xl">Paused</div>
            <button type="button" className="mt-4 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-fg" onClick={() => { if (engineRef.current) engineRef.current.paused = false; setPaused(false); }}>Resume</button>
          </div>
        </div>
      )}

      {screen === "fight" && snap?.phase === "over" && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-elevated p-8 text-center">
            <div className="font-display text-4xl">{snap.outcome === "win" ? "YOU WIN" : "YOU LOSE"}</div>
            <p className="mt-3 text-sm text-muted">Best of three · {snap.winsP} – {snap.winsC}</p>
            <button type="button" className="mt-6 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-fg" onClick={() => { sfx.ui(); setScreen("select"); }}>Again</button>
          </div>
        </div>
      )}

      {fighting && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-6 sm:px-5">
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
            <div />
            <Pad label="▲" sub="Up" glow onDown={() => hold("jump", true)} onUp={() => hold("jump", false)} />
            <div />
            <Pad label="◀" sub="Left" glow onDown={() => hold("left", true)} onUp={() => hold("left", false)} />
            <Pad label="▼" sub="Down" onDown={() => hold("block", true)} onUp={() => hold("block", false)} />
            <Pad label="▶" sub="Right" onDown={() => hold("right", true)} onUp={() => hold("right", false)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pad label="Punch" onDown={() => hold("punch", true)} onUp={() => hold("punch", false)} />
            <Pad label="Kick" onDown={() => hold("kick", true)} onUp={() => hold("kick", false)} />
            <Pad label={specialLabel} onDown={() => hold("special", true)} onUp={() => hold("special", false)} />
            <Pad label="SUPER" sub={snap.superWindow ? "2.5s · ← ▲" : "wait"} superBtn={snap.superWindow} armed={snap.superArmed && snap.superWindow} onDown={() => hold("super", true)} onUp={() => hold("super", false)} />
          </div>
        </div>
      )}

      {screen === "fight" && !touch && (
        <p className="pointer-events-none absolute bottom-[7.5rem] left-0 right-0 text-center text-xs text-muted">
          A/D move · W jump · J punch · K kick · I {specialLabel} · L super
        </p>
      )}
    </div>
  );
}

function Bar({ name, hp, meter, accent, flip }: { name: string; hp: number; meter: number; accent: string; flip: boolean }) {
  return (
    <div className={`min-w-0 flex-1 ${flip ? "text-right" : ""}`}>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide">{name}</div>
      <div className="h-2 overflow-hidden rounded-sm bg-panel">
        <div className={`h-full ${flip ? "ml-auto" : ""}`} style={{ width: `${Math.max(0, hp)}%`, background: accent }} />
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-sm bg-panel">
        <div className={`h-full bg-accent ${flip ? "ml-auto" : ""}`} style={{ width: `${Math.max(0, meter)}%` }} />
      </div>
    </div>
  );
}

function IconBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="pointer-events-auto rounded-lg border border-line bg-elevated/80 px-3 py-2 text-xs font-medium">{label}</button>;
}

function Pad({ label, sub, onDown, onUp, glow, superBtn, armed }: { label: string; sub?: string; onDown: () => void; onUp: () => void; glow?: boolean; superBtn?: boolean; armed?: boolean }) {
  const cls = superBtn ? `super-btn h-14 ${armed ? "armed" : ""}` : glow ? "dir-glow h-12 bg-elevated/85" : "h-12 bg-elevated/80";
  return (
    <button type="button" className={`w-14 rounded-xl border border-line text-xs font-medium sm:w-16 ${cls}`} onPointerDown={(e) => { e.preventDefault(); onDown(); }} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
      <span className="block leading-none">{label}</span>
      {sub ? <span className="mt-0.5 block text-[9px] opacity-80">{sub}</span> : null}
    </button>
  );
}
