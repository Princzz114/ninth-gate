// @ts-nocheck
import { sfx } from "./audio";
import { fighterOf, otherFighter, ROSTER, type BodyId, type FighterId } from "./roster";
export type { FighterId } from "./roster";

export type Anim = "idle" | "walk" | "jump" | "punch" | "kick" | "special" | "hurt";
export type Phase = "intro" | "fight" | "ko" | "over";
type Attack = { name: "punch" | "kick" | "special"; start: number; active: number; recover: number; dmg: number; range: number; height: number; knock: number; meterCost: number; meterGain: number };
export type Fighter = {
  id: FighterId; name: string; body: BodyId; accent: string;
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; max: number; meter: number; anim: Anim; t: number;
  hitDone: boolean; stun: number; invuln: number; blocking: boolean; alive: boolean; cpu: boolean; aiT: number;
  grabT: number; biteStruck: boolean; epic: boolean; whipHits: number;
  punchCount: number; megaPunch: boolean; sweep: boolean;
};
export type Snapshot = {
  phase: Phase; time: number; round: number; winsP: number; winsC: number;
  p: Fighter; c: Fighter; paused: boolean; outcome: "win" | "lose" | null;
  overlay: string; overlayT: number; ready: boolean; superArmed: boolean; superWindow: boolean;
};
export type Actions = { left: boolean; right: boolean; jump: boolean; block: boolean; punch: boolean; kick: boolean; special: boolean; super: boolean };
export type SaveData = { version: number; wins: number; games: number };

export const VW = 1280;
export const VH = 720;
const GROUND = 548;
const GRAVITY = 2100;
const WALK = 170;
const JUMP = -720;
const ATK: Record<string, Attack> = {
	punch: {
		name: "punch",
		start: .06,
		active: .16,
		recover: .18,
		dmg: 8,
		range: 92,
		height: 48,
		knock: 140,
		meterCost: 0,
		meterGain: 8
	},
	kick: {
		name: "kick",
		start: .08,
		active: .18,
		recover: .24,
		dmg: 13,
		range: 118,
		height: 36,
		knock: 220,
		meterCost: 0,
		meterGain: 12
	},
	special: {
		name: "special",
		start: .16,
		active: .18,
		recover: .42,
		dmg: 32,
		range: 168,
		height: 70,
		knock: 380,
		meterCost: 50,
		meterGain: 0
	}
};
const BITE: Attack = {
	name: "special",
	start: .05,
	active: .9,
	recover: .2,
	dmg: 32,
	range: 120,
	height: 90,
	knock: 90,
	meterCost: 50,
	meterGain: 0
};
const ROLL: Attack = {
	name: "special",
	start: .05,
	active: .95,
	recover: .22,
	dmg: 32,
	range: 120,
	height: 90,
	knock: 420,
	meterCost: 50,
	meterGain: 0
};
const WHIP: Attack = {
	name: "special",
	start: .1,
	active: 1.05,
	recover: .22,
	dmg: 40,
	range: 210,
	height: 130,
	knock: 70,
	meterCost: 50,
	meterGain: 0
};
const WHIP_BEATS = [
	.18,
	.5,
	.82
];
function attackOf(f, name) {
	let a = name === "special" && f.body === "eatboss" ? BITE : name === "special" && f.body === "rosa" ? ROLL : name === "special" && f.body === "shen" ? WHIP : ATK[name];
	if (name === "special" && f.epic) return {
		...a,
		dmg: f.body === "shen" ? 58 : 58,
		knock: a.knock + 180,
		meterCost: 0
	};
	return a;
}
function isBite(f) {
	return f.body === "eatboss" && f.anim === "special";
}
function isRoll(f) {
	return f.body === "rosa" && f.anim === "special";
}
function isWhip(f) {
	return f.body === "shen" && f.anim === "special";
}
const WALK_CYCLE = 0.7; // shared CPU/player step clock
function walkFrame(t: number) {
  const u = (((t % WALK_CYCLE) + WALK_CYCLE) % WALK_CYCLE) / WALK_CYCLE;
  if (u < 0.25) return 1;
  if (u < 0.5) return 2;
  if (u < 0.75) return 3;
  return 4;
}
function walkPlant(t: number) {
  const i = walkFrame(t);
  return i === 2 || i === 4;
}
function ikKnee(hx: number, hy: number, fx: number, fy: number, thigh: number, shin: number) {
  const dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy) || 1;
  const max = thigh + shin - 2;
  let px = fx, py = fy;
  if (d > max) { px = hx + (dx / d) * max; py = hy + (dy / d) * max; d = max; }
  const ang = Math.atan2(py - hy, px - hx);
  const cosA = (thigh * thigh + d * d - shin * shin) / (2 * thigh * d);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const kang = ang - a;
  return { x: hx + Math.cos(kang) * thigh, y: hy + Math.sin(kang) * thigh, fx: px, fy: py };
}

const SAVE = "ninth-gate-v1";
export function loadSave(): SaveData {
	try {
		const raw = localStorage.getItem(SAVE);
		return raw ? JSON.parse(raw) : {
			version: 1,
			wins: 0,
			games: 0
		};
	} catch {
		return {
			version: 1,
			wins: 0,
			games: 0
		};
	}
}
export function writeSave(s: SaveData) {
	localStorage.setItem(SAVE, JSON.stringify(s));
}
function chromaKey(img) {
	try {
		const c = document.createElement("canvas");
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		const g = c.getContext("2d");
		if (!g) return img;
		g.drawImage(img, 0, 0);
		const data = g.getImageData(0, 0, c.width, c.height);
		const d = data.data;
		for (let i = 0; i < d.length; i += 4) {
			const r = d[i], gr = d[i + 1], b = d[i + 2];
			if (gr < 55 && r > 170 && b > 70 && r - gr > 80) d[i + 3] = 0;
		}
		g.putImageData(data, 0, 0);
		return c;
	} catch {
		return img;
	}
}
function emptyA() {
	return {
		left: false,
		right: false,
		jump: false,
		block: false,
		punch: false,
		kick: false,
		special: false,
		super: false
	};
}
function makeFighter(id, x, facing, cpu) {
	const rec = fighterOf(id);
	return {
		id,
		name: rec.name,
		body: rec.body,
		accent: rec.accent,
		x,
		y: GROUND,
		vx: 0,
		vy: 0,
		facing,
		hp: 100,
		max: 100,
		meter: rec.body === "eatboss" || rec.body === "rosa" || rec.body === "andrew" || rec.body === "jayden" || rec.body === "shen" || rec.body === "spice" ? 50 : 20,
		anim: "idle",
		t: 0,
		hitDone: false,
		stun: 0,
		invuln: 0,
		blocking: false,
		alive: true,
		cpu,
		aiT: .4,
		grabT: 0,
		biteStruck: false,
		epic: false,
		whipHits: 0,
		punchCount: 0,
		megaPunch: false,
		sweep: false
	};
}
const ANIMS: Anim[] = [
	"idle",
	"walk",
	"jump",
	"punch",
	"kick",
	"special",
	"hurt"
];
export class Engine {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	phase = "intro";
	time = 99;
	round = 1;
	winsP = 0;
	winsC = 0;
	p!: Fighter;
	c!: Fighter;
	playerId = "eatboss";
	cpuId = "mira";
	shake = 0;
	hitStop = 0;
	overlay = "ROUND 1";
	overlayT = 0;
	impactT = 0;
	impactX = 0;
	impactY = 0;
	particles = [];
	slashes = [];
	imgs = /* @__PURE__ */ new Map();
	portraits = /* @__PURE__ */ new Map();
	stage = null;
	readyFlag = false;
	walkClock = 0;
	acc = 0;
	last = 0;
	raf = 0;
	listeners = /* @__PURE__ */ new Set();
	keys = /* @__PURE__ */ new Set();
	touch = emptyA();
	lastA = emptyA();
	comboBuf = [];
	clock = 0;
	superArmed = false;
	superArmedT = 0;
	superWindowT = 0;
	superNext = 2.2;
	charging = false;
	chargeT = 0;
	outcome = null;
	paused = false;
	dead = false;
	_unbind = () => {};
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		this.p = makeFighter("eatboss", 320, 1, false);
		this.c = makeFighter("mira", 960, -1, true);
		const down = (e) => this.keys.add(e.code);
		const up = (e) => this.keys.delete(e.code);
		const blur = () => this.keys.clear();
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", blur);
		this._unbind = () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", blur);
		};
		this.preload();
		this.last = performance.now();
		this.raf = requestAnimationFrame((t) => this.loop(t));
		if (import.meta.env.DEV || location.search.includes("qa=1")) window.__controlsTest = {
			getX: () => this.p.x,
			getYaw: () => this.p.x,
			getSpeed: () => Math.abs(this.p.vx),
			setKeys: (codes) => {
				this.keys.clear();
				for (const c of codes) this.keys.add(c);
			},
			setX: (x) => {
				this.p.x = x;
			},
			bite: () => {
				this.p.stun = 0;
				this.p.meter = 100;
				this.p.x = 820;
				this.tryAttack(this.p, "special");
			},
			whip: () => {
				this.p.stun = 0;
				this.p.meter = 100;
				this.p.x = this.c.x - this.p.facing * 150;
				this.tryAttack(this.p, "special");
			},
			special: () => {
				this.p.stun = 0;
				this.superWindowT = 2.5;
				this.superArmed = true;
				this.beginSuper(this.p);
			},
			hurt: () => {
				this.setAnim(this.p, "hurt");
				this.p.stun = .4;
				this.p.vy = -90;
				this.p.vx = -this.p.facing * 140;
			}
		};
	}
	setTouch(partial) {
		this.touch = {
			...this.touch,
			...partial
		};
	}
	subscribe(fn) {
		this.listeners.add(fn);
		fn(this.snap());
		return () => this.listeners.delete(fn);
	}
	snap() {
		return {
			phase: this.phase,
			time: this.time,
			round: this.round,
			winsP: this.winsP,
			winsC: this.winsC,
			p: this.p,
			c: this.c,
			paused: this.paused,
			outcome: this.outcome,
			overlay: this.overlay,
			overlayT: this.overlayT,
			ready: this.readyFlag,
			superArmed: this.superArmed,
			superWindow: this.superWindowT > 0
		};
	}
	emit() {
		const s = this.snap();
		for (const fn of this.listeners) fn(s);
	}
	resize() {
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	loadSprite(who, a, i) {
		return new Promise((res) => {
			const im = new Image();
			im.onload = () => {
				this.imgs.set(`${who}:${a}:${i}`, chromaKey(im));
				res();
			};
			im.onerror = () => res();
			im.src = `/sprites/${who}/${a}-${i}.png?v=24`;
		});
	}
	loadPortrait(id) {
		return new Promise((res) => {
			const im = new Image();
			im.onload = () => {
				this.portraits.set(id, im);
				res();
			};
			im.onerror = () => res();
			im.src = `/portraits/${id}.jpg?v=6`;
		});
	}
	async preload() {
		const bodies = [
			"kael",
			"mira",
			"eatboss",
			"rosa",
			"andrew",
			"jayden",
			"shen",
			"spice"
		];
		const jobs = [];
		for (const who of bodies) for (const a of ["idle", "punch", "kick"]) for (let i = 1; i <= 4; i++) jobs.push(this.loadSprite(who, a, i));
		for (const rec of ROSTER) jobs.push(this.loadPortrait(rec.id));
		const stage = new Image();
		stage.src = "/stages/rooftop.jpg?v=6";
		jobs.push(new Promise((res) => {
			stage.onload = () => {
				this.stage = stage;
				res();
			};
			stage.onerror = () => res();
		}));
		await Promise.all(jobs);
		this.readyFlag = true;
		this.emit();
		for (const who of bodies) for (const a of ANIMS) if (a !== "idle") for (let i = 1; i <= 4; i++) this.loadSprite(who, a, i);
	}
	start(id) {
		this.playerId = id;
		this.cpuId = otherFighter(id);
		this.winsP = 0;
		this.winsC = 0;
		this.round = 1;
		this.outcome = null;
		this.resetRound();
		this.phase = "intro";
		this.overlay = "ROUND 1";
		this.overlayT = 1.6;
	}
	resetRound() {
		this.p = makeFighter(this.playerId, 320, 1, false);
		this.c = makeFighter(this.cpuId, 960, -1, true);
		this.time = 99;
		this.particles = [];
		this.slashes = [];
		this.shake = 0;
		this.hitStop = 0;
		this.comboBuf = [];
		this.superArmed = false;
		this.superArmedT = 0;
		this.clock = 0;
		this.superWindowT = 0;
		this.superNext = 2.2;
		this.charging = false;
		this.chargeT = 0;
		this.keys.clear();
		this.touch = emptyA();
		this.lastA = emptyA();
	}
	busy(f) {
		return f.anim === "punch" || f.anim === "kick" || f.anim === "special" || f.anim === "hurt" || f.stun > 0;
	}
	setAnim(f, a) {
		if (f.anim === a) return;
		const keepStep = (f.anim === "idle" && a === "walk") || (f.anim === "walk" && a === "idle");
		f.anim = a;
		if (!keepStep) f.t = 0;
		f.hitDone = false;
		f.grabT = 0;
		f.biteStruck = false;
		f.whipHits = 0;
		if (a !== "special") f.epic = false;
		if (a !== "kick") f.sweep = false;
	}
	actions() {
		const k = this.keys;
		return {
			left: k.has("KeyA") || k.has("ArrowLeft") || this.touch.left,
			right: k.has("KeyD") || k.has("ArrowRight") || this.touch.right,
			jump: k.has("KeyW") || k.has("ArrowUp") || k.has("Space") || this.touch.jump,
			block: k.has("KeyS") || k.has("ArrowDown") || this.touch.block,
			punch: k.has("KeyJ") || k.has("KeyZ") || this.touch.punch,
			kick: k.has("KeyK") || k.has("KeyX") || this.touch.kick,
			special: k.has("KeyI") || k.has("KeyC") || this.touch.special,
			super: k.has("KeyL") || k.has("Semicolon") || this.touch.super
		};
	}
	tryAttack(f, name) {
		if (this.busy(f) || !f.alive) return;
		const a = attackOf(f, name);
		if (!(name === "special" && f.epic)) {
			if (f.meter < a.meterCost) return;
			f.meter -= a.meterCost;
		}
		this.setAnim(f, name);
		if (name === "punch") {
			f.punchCount = (f.punchCount || 0) + 1;
			f.megaPunch = f.punchCount % 4 === 0;
			sfx.punch();
		} else if (name === "kick") {
			f.sweep = !!this.actions().block && f.y >= GROUND - 4;
			if (f.sweep) f.vx = f.facing * 220;
			sfx.kick();
		}
		else if (f.body === "eatboss") {
			f.vx = f.facing * 580;
			f.invuln = Math.max(f.invuln, .28);
			sfx.bite();
		} else if (f.body === "rosa") {
			f.vx = f.facing * 720;
			f.invuln = Math.max(f.invuln, .28);
			sfx.special();
		} else if (f.body === "shen") {
			f.vx = f.facing * 80;
			f.invuln = Math.max(f.invuln, 1.1);
			f.whipHits = 0;
			sfx.special();
		} else if (f.body === "spice") {
			f.vx = f.facing * 480;
			f.invuln = Math.max(f.invuln, .28);
			sfx.special();
		} else sfx.special();
	}
	beginSuper(f) {
		if (this.charging || this.busy(f) || !f.alive || this.superWindowT <= 0 || !this.superArmed) return;
		this.charging = true;
		this.chargeT = .55;
		this.superWindowT = 0;
		this.superArmed = false;
		this.comboBuf = [];
		this.superNext = 9;
		f.vx = 0;
		f.vy = 0;
		f.invuln = .7;
		this.overlay = "SUPER";
		this.overlayT = .7;
		sfx.special();
		sfx.hit();
	}
	pushDir(d) {
		this.comboBuf.push({
			d,
			t: this.clock
		});
		this.comboBuf = this.comboBuf.filter((x) => this.clock - x.t < .85);
		const n = this.comboBuf.length;
		if (n >= 2 && this.comboBuf[n - 2].d === "left" && this.comboBuf[n - 1].d === "up" && this.superWindowT > 0) {
			this.superArmed = true;
			this.superArmedT = this.superWindowT;
		}
	}
	trackCombo(a, prev) {
		if (a.left && !prev.left) this.pushDir("left");
		if (a.right && !prev.right) this.pushDir("right");
		if (a.jump && !prev.jump) this.pushDir("up");
		if (a.block && !prev.block) this.pushDir("down");
	}
	updateFighter(f, a, prev, dt) {
		if (!f.alive) {
			f.y = GROUND;
			f.vx = 0;
			this.setAnim(f, "hurt");
			return;
		}
		f.t += dt;
		f.stun = Math.max(0, f.stun - dt);
		f.invuln = Math.max(0, f.invuln - dt);
		const air = f.y < 547;
		if (f.anim === "punch" || f.anim === "kick" || f.anim === "special") {
			if (!(isBite(f) && f.hitDone && f.grabT < .62)) {
				const spec = attackOf(f, f.anim);
				if (f.t >= spec.start + spec.active + spec.recover) this.setAnim(f, air ? "jump" : "idle");
			}
		} else if (f.anim === "hurt" && f.t > .32 && f.stun <= 0) this.setAnim(f, air ? "jump" : "idle");
		if (isRoll(f) && !f.hitDone && f.t < ROLL.start + ROLL.active) {
			f.vx = f.facing * 720;
			f.vy = 0;
			f.y = GROUND;
		}
		if (isBite(f) && !f.hitDone && f.t < BITE.start + .5) {
			f.vx = f.facing * 580;
			f.vy = 0;
			f.y = GROUND;
		}
		if (isBite(f) && f.hitDone) {
			f.vx = 0;
			f.vy = 0;
			f.y = GROUND;
			f.grabT += dt;
		}
		if (isWhip(f)) {
			f.vx = 0;
			f.vy = 0;
			f.y = GROUND;
		}
		f.blocking = !this.busy(f) && !air && a.block && !a.kick;
		if (!this.busy(f) && !air) {
			if (a.jump && !prev.jump) {
				f.vy = JUMP;
				this.setAnim(f, "jump");
			} else if (a.punch && !prev.punch) this.tryAttack(f, "punch");
			else if (a.kick && !prev.kick) this.tryAttack(f, "kick");
			else if (a.special && !prev.special) this.tryAttack(f, "special");
		}
		if (!f.cpu && a.super && !prev.super) this.beginSuper(f);
		if (!this.busy(f) && !f.blocking) {
			let dir = 0;
			if (a.left) dir -= 1;
			if (a.right) dir += 1;
			if (!air) {
				const planted = f.anim === "walk" && walkPlant(this.walkClock);
				f.vx = dir * WALK * (dir ? (planted ? 0.86 : 1.1) : 0);
				if (dir) {
					f.facing = dir;
					if (f.anim === "idle") this.setAnim(f, "walk");
				} else if (f.anim === "walk") this.setAnim(f, "idle");
			}
		}
		f.vy += GRAVITY * dt;
		f.x += f.vx * dt;
		f.y += f.vy * dt;
		if (f.y >= GROUND) {
			f.y = GROUND;
			f.vy = 0;
			if (f.anim === "jump") this.setAnim(f, "idle");
		}
		f.x = Math.max(80, Math.min(1200, f.x));
		f.meter = Math.min(100, f.meter + dt * 4);
	}
	cpuAct(dt) {
		const e = this.c, p = this.p;
		e.aiT -= dt;
		const dx = p.x - e.x, dist = Math.abs(dx), towardLeft = dx < 0, a = emptyA();
		if (!e.alive) return a;
		e.facing = dx >= 0 ? 1 : -1;
		if ((p.anim === "punch" || p.anim === "kick" || p.anim === "special") && dist < 160 && Math.random() < .55) a.block = true;
		if (dist > 150) {
			a.left = towardLeft;
			a.right = !towardLeft;
		} else if (dist < 70) {
			a.left = !towardLeft;
			a.right = towardLeft;
		}
		if (e.aiT <= 0) {
			e.aiT = .28 + Math.random() * .45;
			if (dist < 170 && !a.block) {
				const r = Math.random();
				if (e.meter >= 50 && r > .78) a.special = true;
				else if (r > .42) a.kick = true;
				else a.punch = true;
			} else if (dist > 220 && Math.random() < .15) a.jump = true;
		}
		return a;
	}
	hitboxes(f) {
		if (isRoll(f) || isBite(f) || isWhip(f)) return null;
		if (!(f.anim === "punch" || f.anim === "kick" || f.anim === "special")) return null;
		const spec = attackOf(f, f.anim);
		if (f.t < spec.start || f.t > spec.start + spec.active || f.hitDone) return null;
		const mega = f.anim === "punch" && f.megaPunch;
		if (f.anim === "kick" && f.sweep) {
			return {
				x: f.x + f.facing * 58,
				y: f.y - 16,
				w: 90,
				h: 32,
				spec: { ...spec, dmg: spec.dmg, knock: spec.knock + 40, name: "kick" }
			};
		}
		return {
			x: f.x + f.facing * (40 + spec.range * (mega ? .55 : .35)),
			y: f.y - 90,
			w: spec.range * (mega ? .85 : .55),
			h: spec.height * (mega ? 1.4 : 1),
			spec: mega ? { ...spec, dmg: spec.dmg * 2.5, knock: spec.knock + 80 } : spec
		};
	}
	connectBite(atk, def) {
		if (def.blocking && def.y >= 547) {
			atk.hitDone = true;
			atk.biteStruck = true;
			atk.vx = -atk.facing * 200;
			atk.t = BITE.start + BITE.active;
			def.vx = atk.facing * 110;
			sfx.block();
			this.overlay = "BLOCK";
			this.overlayT = .35;
			return;
		}
		atk.hitDone = true;
		atk.biteStruck = false;
		atk.grabT = 0;
		atk.vx = 0;
		atk.vy = 0;
		def.vx = 0;
		def.vy = 0;
		def.stun = .85;
		def.invuln = .85;
		def.blocking = false;
		def.facing = atk.facing === 1 ? -1 : 1;
		def.y = 538;
		def.x = atk.x + atk.facing * 38;
		this.setAnim(def, "hurt");
		this.overlay = "GRAB";
		this.overlayT = .32;
		sfx.ui();
	}
	strikeBite(atk, def) {
		if (atk.biteStruck || !def.alive) return;
		atk.biteStruck = true;
		def.hp -= attackOf(atk, "special").dmg;
		this.shake = 1;
		this.hitStop = .16;
		this.impactT = .34;
		this.impactX = atk.x + atk.facing * 62;
		this.impactY = def.y - 138;
		sfx.bite();
		sfx.hit();
		this.overlay = "BITE";
		this.overlayT = .5;
		this.burst(this.impactX, this.impactY, atk.facing);
		if (def.hp <= 0) {
			def.hp = 0;
			def.alive = false;
			sfx.ko();
		}
	}
	connectSweep(atk, def) {
		if (atk.hitDone || !def.alive) return;
		atk.hitDone = true;
		const spec = attackOf(atk, "kick");
		this.impactT = .28;
		this.impactX = def.x;
		this.impactY = def.y - 18;
		if (def.blocking && def.y >= GROUND - 4) {
			def.hp -= spec.dmg * .2;
			def.vx = atk.facing * 70;
			sfx.block();
			this.overlay = "BLOCK";
			this.overlayT = .2;
			return;
		}
		def.hp -= spec.dmg;
		def.vx = atk.facing * 280;
		def.vy = -90;
		def.stun = .42;
		def.invuln = .14;
		this.setAnim(def, "hurt");
		this.shake = .45;
		this.hitStop = .06;
		sfx.hit();
		this.overlay = "SWEEP";
		this.overlayT = .32;
		this.burst(def.x, def.y - 20, atk.facing);
		if (def.hp <= 0) {
			def.hp = 0;
			def.alive = false;
			sfx.ko();
		}
	}
	connectWhip(atk, def) {
		if (!def.alive || atk.whipHits >= 3) return;
		const beat = WHIP_BEATS[atk.whipHits];
		if (atk.t < beat || atk.t > beat + .14) return;
		if (Math.abs(atk.x - def.x) > 220 || Math.abs(atk.y - def.y) > 170) return;
		const dmg = (atk.epic ? 58 : def.max * .4) / 3;
		atk.whipHits += 1;
		const hx = atk.x + atk.facing * (90 + atk.whipHits * 18);
		const hy = def.y - 110;
		if (def.blocking && def.y >= 547) {
			def.hp -= dmg * .2;
			def.vx = atk.facing * 50;
			sfx.block();
			this.overlay = "BLOCK";
			this.overlayT = .22;
		} else {
			def.hp -= dmg;
			def.vx = atk.facing * 40;
			def.vy = 0;
			def.y = GROUND;
			def.stun = .85;
			def.invuln = 0;
			this.setAnim(def, "hurt");
			this.shake = .7;
			this.hitStop = .045;
			sfx.hit();
			sfx.special();
			this.overlay = atk.whipHits === 3 ? "LASH x3" : `LASH ${atk.whipHits}`;
			this.overlayT = .38;
			this.burst(hx, hy, atk.facing);
		}
		this.impactT = .28;
		this.impactX = hx;
		this.impactY = hy;
		this.slashes.push({
			x: hx,
			y: hy,
			dir: atk.facing,
			t: .28,
			n: atk.whipHits
		});
		if (def.hp <= 0) {
			def.hp = 0;
			def.alive = false;
			sfx.ko();
		}
	}
	connectRoll(atk, def) {
		atk.hitDone = true;
		atk.vx = -atk.facing * 200;
		atk.t = ROLL.start + ROLL.active;
		const spec = attackOf(atk, "special");
		if (def.blocking && def.y >= 547) {
			def.hp -= spec.dmg * .2;
			def.vx = atk.facing * 120;
			sfx.block();
			return;
		}
		def.hp -= spec.dmg;
		def.x = atk.x + atk.facing * 96;
		def.vx = atk.facing * spec.knock;
		def.vy = -360;
		def.stun = .45;
		def.invuln = .2;
		this.setAnim(def, "hurt");
		this.shake = 1;
		this.hitStop = .18;
		this.impactT = .32;
		this.impactX = (atk.x + def.x) / 2;
		this.impactY = atk.y - 90;
		sfx.hit();
		sfx.special();
		this.overlay = "HIT";
		this.overlayT = .55;
		this.burst(this.impactX, this.impactY, atk.facing);
		if (def.hp <= 0) {
			def.hp = 0;
			def.alive = false;
			sfx.ko();
		}
	}
	resolveHits() {
		for (const [atk, def] of [[this.p, this.c], [this.c, this.p]]) {
			if (!def.alive) continue;
			if (isBite(atk) && !atk.hitDone && atk.t >= BITE.start && atk.t <= BITE.start + .55) {
				if (Math.abs(atk.x - def.x) < 118) this.connectBite(atk, def);
				continue;
			}
			if (isRoll(atk) && !atk.hitDone && atk.t >= ROLL.start && atk.t <= ROLL.start + ROLL.active) {
				if (Math.abs(atk.x - def.x) < 108) this.connectRoll(atk, def);
				continue;
			}
			if (isWhip(atk)) {
				this.connectWhip(atk, def);
				continue;
			}
			if (atk.anim === "kick" && atk.sweep && !atk.hitDone) {
				const spec = attackOf(atk, "kick");
				if (atk.t >= spec.start && atk.t <= spec.start + spec.active) {
					const close = Math.abs(atk.x - def.x) < 112;
					const low = def.y >= GROUND - 12;
					if (close && low) this.connectSweep(atk, def);
				}
				continue;
			}
			const box = this.hitboxes(atk);
			if (!box || def.invuln > 0) continue;
			if (Math.abs(box.x - def.x) < box.w * .5 + 36 && Math.abs(box.y - (def.y - 90)) < box.h * .5 + 70) {
				atk.hitDone = true;
				atk.meter = Math.min(100, atk.meter + box.spec.meterGain);
				if (def.blocking && def.y >= 547) {
					def.hp -= box.spec.dmg * .18;
					def.vx = atk.facing * 80;
					sfx.block();
				} else {
					def.hp -= box.spec.dmg;
					def.vx = atk.facing * box.spec.knock;
					def.vy = box.spec.name === "special" ? -240 : -80;
					def.stun = .28;
					def.invuln = .12;
					this.setAnim(def, "hurt");
					this.shake = Math.min(1, this.shake + (atk.megaPunch ? .7 : .35));
					this.hitStop = atk.megaPunch ? .09 : .05;
					sfx.hit();
					this.burst(def.x, def.y - 100, atk.facing);
				}
				if (def.hp <= 0) {
					def.hp = 0;
					def.alive = false;
					sfx.ko();
				}
			}
		}
	}
	pinBite() {
		for (const atk of [this.p, this.c]) {
			if (!isBite(atk) || !atk.hitDone) continue;
			if (atk.biteStruck && atk.grabT < .18) continue;
			const def = atk === this.p ? this.c : this.p;
			if (!def.alive) continue;
			if (atk.grabT >= .18) this.strikeBite(atk, def);
			if (atk.grabT < .52) {
				const bite = atk.grabT > .16;
				def.x = atk.x + atk.facing * (bite ? 32 : 38);
				def.y = GROUND - (bite ? 28 : 10);
				def.vx = 0;
				def.vy = 0;
				def.facing = atk.facing === 1 ? -1 : 1;
			} else {
				def.vx = atk.facing * 280;
				def.vy = -240;
			}
		}
	}
	burst(x, y, dir) {
		for (let i = 0; i < 16; i++) {
			const a = Math.PI * 2 * i / 16, spd = 240 + Math.random() * 260;
			this.particles.push({
				x,
				y,
				vx: Math.cos(a) * spd + dir * 40,
				vy: Math.sin(a) * spd - 80,
				life: .3,
				color: i % 2 ? "#ffe27a" : "#eceef2",
				size: 3
			});
		}
	}
	update(dt) {
		if (this.paused || this.phase === "over") return;
		this.overlayT = Math.max(0, this.overlayT - dt);
		this.impactT = Math.max(0, this.impactT - dt);
		if (this.phase === "intro") {
			if (!this.readyFlag) {
				this.overlay = "LOADING";
				this.overlayT = 1;
				return;
			}
			if (this.overlay === "LOADING") {
				this.overlay = `ROUND ${this.round}`;
				this.overlayT = 1.6;
				return;
			}
			if (this.overlayT <= 0) {
				this.phase = "fight";
				this.overlay = "FIGHT";
				this.overlayT = .7;
			}
			return;
		}
		if (this.hitStop > 0) {
			this.hitStop -= dt;
			return;
		}
		if (this.phase === "fight") {
			this.time -= dt;
			this.clock += dt;
			if (this.charging) {
				this.chargeT -= dt;
				this.p.vx = 0;
				this.p.vy = 0;
				this.p.y = GROUND;
				this.particles.push({
					x: this.p.x + (Math.random() - .5) * 60,
					y: this.p.y - 80 - Math.random() * 80,
					vx: (Math.random() - .5) * 180,
					vy: -120,
					life: .25,
					color: "#ffe27a",
					size: 4
				});
				if (this.chargeT <= 0) {
					this.charging = false;
					this.p.epic = true;
					this.p.stun = 0;
					this.tryAttack(this.p, "special");
				}
			} else if (this.superWindowT > 0) {
				this.superWindowT -= dt;
				if (this.superWindowT <= 0) {
					this.superArmed = false;
					this.superNext = 8;
				}
			} else {
				this.superNext -= dt;
				if (this.superNext <= 0) this.superWindowT = 2.5;
			}
			if (this.superArmedT > 0) {
				this.superArmedT -= dt;
				if (this.superArmedT <= 0) this.superArmed = false;
			}
			const pa = this.actions();
			this.walkClock += dt;
			this.trackCombo(pa, this.lastA);
			this.updateFighter(this.p, pa, this.lastA, dt);
			this.updateFighter(this.c, this.cpuAct(dt), emptyA(), dt);
			this.lastA = { ...pa };
			const gap = this.c.x - this.p.x;
			if (!(isBite(this.p) || isBite(this.c) || isRoll(this.p) && !this.p.hitDone || isRoll(this.c) && !this.c.hitDone || isWhip(this.p) || isWhip(this.c)) && Math.abs(gap) < 70) {
				const mid = (this.p.x + this.c.x) / 2, s = Math.sign(gap || 1);
				this.p.x = mid - 35 * s;
				this.c.x = mid + 35 * s;
			}
			this.pinBite();
			this.resolveHits();
			this.shake = Math.max(0, this.shake - dt * 2.4);
			for (const pt of this.particles) {
				pt.x += pt.vx * dt;
				pt.y += pt.vy * dt;
				pt.vy += 600 * dt;
				pt.life -= dt;
			}
			this.particles = this.particles.filter((pt) => pt.life > 0);
			for (const s of this.slashes) s.t -= dt;
			this.slashes = this.slashes.filter((s) => s.t > 0);
			if (!this.p.alive || !this.c.alive || this.time <= 0) {
				this.phase = "ko";
				this.overlayT = 1.8;
				if (!this.p.alive && this.c.alive) {
					this.winsC += 1;
					this.overlay = "K.O.";
				} else if (!this.c.alive && this.p.alive) {
					this.winsP += 1;
					this.overlay = "K.O.";
				} else {
					if (this.p.hp >= this.c.hp) this.winsP += 1;
					else this.winsC += 1;
					this.overlay = "TIME";
				}
			}
		} else if (this.phase === "ko" && this.overlayT <= 0) {
			if (this.winsP >= 2 || this.winsC >= 2) {
				this.phase = "over";
				this.outcome = this.winsP > this.winsC ? "win" : "lose";
				this.overlay = this.outcome === "win" ? "YOU WIN" : "YOU LOSE";
				if (this.outcome === "win") sfx.win();
			} else {
				this.round += 1;
				this.resetRound();
				this.phase = "intro";
				this.overlay = `ROUND ${this.round}`;
				this.overlayT = 1.5;
			}
		}
	}
	frameIndex(f) {
		if (isBite(f)) {
			if (!f.hitDone) return f.t < .12 ? 1 : 2;
			if (f.grabT < .14) return 2;
			if (f.grabT < .2) return 3;
			return 4;
		}
		if (isWhip(f)) {
			if (f.t < .18) return 1;
			if (f.t < .5) return 2;
			if (f.t < .82) return 3;
			return 4;
		}
		if (f.anim === "walk") return walkFrame(this.walkClock);
		if (f.anim === "punch" || f.anim === "kick") {
			const spec = attackOf(f, f.anim);
			if (f.anim === "punch" && f.megaPunch && f.t >= spec.start) return 3;
			if (f.t < spec.start) return 1;
			if (f.t < spec.start + spec.active) return 2;
			return 1;
		}
		const spd = f.anim === "idle" ? 6 : isRoll(f) ? 22 : 12;
		return 1 + Math.floor(f.t * spd) % 4;
	}
	spriteFor(f) {
		if (f.anim === "walk") {
			const i = walkFrame(this.walkClock);
			return this.imgs.get(`${f.body}:walk:${i}`) || this.imgs.get(`${f.body}:walk:1`) || this.imgs.get(`${f.body}:idle:1`);
		}
		const i = this.frameIndex(f);
		return this.imgs.get(`${f.body}:${f.anim}:${i}`) || this.imgs.get(`${f.body}:${f.anim}:1`) || this.imgs.get(`${f.body}:idle:1`);
	}
	drawStandIn(f, sx, sy) {
		const ctx = this.ctx;
		const port = this.portraits.get(f.id) || this.portraits.get(f.body);
		ctx.fillStyle = "rgba(0,0,0,0.28)";
		ctx.beginPath();
		ctx.ellipse(0, 0, 26 * sx, 8 * sy, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#16181f";
		ctx.strokeStyle = f.accent;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.ellipse(-10 * sx, -6 * sy, 14 * sx, 7 * sy, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(12 * sx, -6 * sy, 15 * sx, 7 * sy, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.roundRect(-22 * sx, -128 * sy, 44 * sx, 118 * sy, 14);
		ctx.fill();
		ctx.stroke();
		if (port) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(0, -148 * sy, 28 * sx, 0, Math.PI * 2);
			ctx.clip();
			ctx.drawImage(port, -32 * sx, -186 * sy, 64 * sx, 80 * sy);
			ctx.restore();
			ctx.strokeStyle = f.accent;
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(0, -148 * sy, 28 * sx, 0, Math.PI * 2);
			ctx.stroke();
		} else {
			ctx.beginPath();
			ctx.arc(0, -148 * sy, 22 * sx, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}
	}
	drawArena(w, h) {
		const ctx = this.ctx;
		const gy = GROUND / VH * h;
		const sky = ctx.createLinearGradient(0, 0, 0, h);
		sky.addColorStop(0, "#24365c");
		sky.addColorStop(.5, "#141824");
		sky.addColorStop(1, "#0d1016");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = "#f2e6b8";
		ctx.beginPath();
		ctx.arc(w * .82, h * .14, Math.min(w, h) * .07, 0, Math.PI * 2);
		ctx.fill();
		for (let i = 0; i < 16; i++) {
			const bw = w / 16, bh = 50 + i * 41 % 140;
			ctx.fillStyle = i % 3 ? "#10141c" : "#161c28";
			ctx.fillRect(i * bw, gy - 36 - bh, bw - 3, bh);
			ctx.fillStyle = "#e8c45c";
			for (let wy = 8; wy < bh - 10; wy += 14) if ((i + wy) % 2) ctx.fillRect(i * bw + 6, gy - 36 - bh + wy, 5, 6);
		}
		ctx.fillStyle = "#3a3f4a";
		ctx.fillRect(0, gy - 10, w, h - gy + 10);
		ctx.fillStyle = "#c9a227";
		ctx.fillRect(0, gy - 8, w, 5);
		ctx.fillStyle = "#1a1d24";
		ctx.fillRect(0, gy + 2, w, 8);
		if (this.stage && this.stage.naturalWidth > 0) {
			const img = this.stage, scale = Math.max(w / img.width, h / img.height);
			ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
		}
	}

	drawLeg(hx: number, hy: number, fx: number, fy: number, sx: number, sy: number, accent: string, thigh: number, shin: number) {
		const ctx = this.ctx;
		const k = ikKnee(hx, hy, fx, fy, thigh, shin);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = "#0c0e12";
		ctx.lineWidth = 22 * sx;
		ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(k.x, k.y); ctx.lineTo(k.fx, k.fy); ctx.stroke();
		ctx.strokeStyle = accent;
		ctx.lineWidth = 14 * sx;
		ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(k.x, k.y); ctx.lineTo(k.fx, k.fy); ctx.stroke();
		ctx.fillStyle = "#eceef2";
		ctx.beginPath();
		ctx.arc(k.x, k.y, 7 * sx, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "#0c0e12";
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.fillStyle = "#0e1014";
		ctx.beginPath();
		ctx.ellipse(k.fx + 11 * sx, k.fy - 3 * sy, 18 * sx, 8 * sy, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	drawWalk(f: Fighter, sx: number, sy: number, im: CanvasImageSource | undefined, dw: number) {
		const ctx = this.ctx;
		const body = im || this.imgs.get(`${f.body}:walk:${walkFrame(this.walkClock)}`) || this.imgs.get(`${f.body}:walk:1`) || this.imgs.get(`${f.body}:idle:1`);
		if (!body) { this.drawStandIn(f, sx, sy); return; }
		const iw = (body as HTMLCanvasElement).width || 128;
		const ih = (body as HTMLCanvasElement).height || 128;
		const dh = dw * (ih / Math.max(1, iw));
		ctx.fillStyle = "rgba(0,0,0,0.22)";
		ctx.beginPath();
		ctx.ellipse(0, 2 * sy, 24 * sx, 7 * sy, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.translate(0, walkPlant(this.walkClock) ? -2 * sy : 3 * sy);
		ctx.drawImage(body, -dw / 2, -dh, dw, dh);
	}
	drawStrike(f: Fighter, sx: number, sy: number, im: CanvasImageSource | undefined, dw: number) {
		const ctx = this.ctx;
		const punch = f.anim === "punch";
		const spec = attackOf(f, punch ? "punch" : "kick");
		const wind = Math.min(1, f.t / Math.max(0.04, spec.start));
		const inHit = f.t >= spec.start && f.t < spec.start + spec.active;
		const mega = punch && f.megaPunch;
		const sweep = !punch && f.sweep;
		const reach = inHit ? 1 : 0.4 + 0.6 * wind;
		ctx.translate((inHit ? (sweep ? 36 : 14) : 8 * wind) * sx, punch ? 0 : sweep ? 18 * sy : -10 * sy * reach);
		ctx.rotate((punch ? -0.06 : sweep ? 0.55 : 0.12) * reach);
		const body = im || this.imgs.get(`${f.body}:punch:2`) || this.imgs.get(`${f.body}:idle:1`);
		if (body) {
			const iw = (body as HTMLCanvasElement).width || 128;
			const ih = (body as HTMLCanvasElement).height || 128;
			const dh = dw * (ih / Math.max(1, iw));
			ctx.fillStyle = "rgba(0,0,0,0.22)";
			ctx.beginPath();
			ctx.ellipse(0, 2 * sy, 24 * sx, 7 * sy, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.drawImage(body, -dw / 2, -dh, dw, dh);
		} else this.drawStandIn(f, sx, sy);
	}
	drawFighter(f: Fighter, cssW: number, cssH: number) {
		const ctx = this.ctx, sx = cssW / VW, sy = cssH / VH, im = this.spriteFor(f);
		const dw = 220 * sx;
		ctx.save();
		ctx.translate(f.x * sx, f.y * sy);
		ctx.scale(f.facing, 1);
		const eater = isBite(this.p) && this.p.hitDone && f === this.c ? this.p : isBite(this.c) && this.c.hitDone && f === this.p ? this.c : null;
		if (eater) {
			const s = eater.grabT > .16 ? .78 : .88;
			ctx.translate(0, -10 * sy);
			ctx.scale(s, s);
		}
		if (f.blocking) ctx.globalAlpha = .85;
		if (f.anim === "walk") {
			this.drawWalk(f, sx, sy, im, dw);
		} else if (isRoll(f) && f.t > .06) {
			const dh = dw;
			ctx.translate(0, -dh * .4);
			ctx.rotate(f.t * Math.PI * 2 * 4);
			const ball = this.imgs.get(`${f.body}:special:1`) || im;
			if (ball) ctx.drawImage(ball, -dw / 2, -dh / 2, dw, dh);
			else this.drawStandIn(f, sx, sy);
		} else if (f.anim === "punch" || f.anim === "kick") {
			this.drawStrike(f, sx, sy, im, dw);
		} else if (im) {
			const iw = (im as HTMLCanvasElement).width || 128;
			const ih = (im as HTMLCanvasElement).height || 128;
			const wide = isWhip(f) ? 280 * sx : dw;
			const dh = wide * (ih / Math.max(1, iw));
			ctx.fillStyle = "rgba(0,0,0,0.22)";
			ctx.beginPath();
			ctx.ellipse(0, 2 * sy, 24 * sx, 7 * sy, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.drawImage(im, -wide / 2 + (isWhip(f) ? 18 * sx : 0), -dh, wide, dh);
		} else this.drawStandIn(f, sx, sy);
		ctx.restore();
	}
	render() {
		const ctx = this.ctx, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		if (w < 2 || h < 2) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) this.resize();
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		ctx.translate((Math.random() * 2 - 1) * 8 * this.shake, (Math.random() * 2 - 1) * 6 * this.shake);
		this.drawArena(w, h);
		const pGrab = isBite(this.p) && this.p.hitDone, cGrab = isBite(this.c) && this.c.hitDone;
		if (pGrab) {
			this.drawFighter(this.c, w, h);
			this.drawFighter(this.p, w, h);
		} else if (cGrab) {
			this.drawFighter(this.p, w, h);
			this.drawFighter(this.c, w, h);
		} else {
			this.drawFighter(this.p, w, h);
			this.drawFighter(this.c, w, h);
		}
		if (this.impactT > 0) {
			const a = Math.min(1, this.impactT / .22);
			ctx.globalAlpha = a;
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 6;
			ctx.beginPath();
			ctx.arc(this.impactX / VW * w, this.impactY / 720 * h, 18 + (1 - a) * 80, 0, Math.PI * 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
		for (const sl of this.slashes) {
			const a = Math.min(1, sl.t / .28);
			const cx = sl.x / VW * w, cy = sl.y / VH * h;
			ctx.save();
			ctx.globalAlpha = a;
			ctx.translate(cx, cy);
			ctx.scale(sl.dir, 1);
			ctx.strokeStyle = "#eceef2";
			ctx.lineWidth = 7;
			ctx.beginPath();
			ctx.ellipse(20, 0, 70 + (1 - a) * 40, 28, -.5, .2, Math.PI * 1.3);
			ctx.stroke();
			ctx.strokeStyle = sl.n === 3 ? "#ffe27a" : "#8eb4e8";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.ellipse(28, -6, 58 + (1 - a) * 30, 18, -.45, .15, Math.PI * 1.25);
			ctx.stroke();
			ctx.restore();
		}
		for (const pt of this.particles) {
			ctx.fillStyle = pt.color || "#fff";
			ctx.globalAlpha = Math.max(0, pt.life * 3);
			ctx.fillRect(pt.x / VW * w, pt.y / VH * h, pt.size || 3, pt.size || 3);
		}
		ctx.globalAlpha = 1;
		ctx.restore();
	}
	destroy() {
		this.dead = true;
		cancelAnimationFrame(this.raf);
		this._unbind();
	}
	loop(now) {
		if (this.dead) return;
		const dt = Math.min(.05, (now - this.last) / 1e3);
		this.last = now;
		this.acc += dt;
		const step = 1 / 60;
		while (this.acc >= step) {
			this.update(step);
			this.acc -= step;
		}
		this.render();
		this.emit();
		this.raf = requestAnimationFrame((t) => this.loop(t));
	}
}

declare global {
  interface Window {
    __controlsTest?: { getX: () => number; getYaw: () => number; getSpeed: () => number; setKeys?: (codes: string[]) => void; setX?: (x: number) => void; bite?: () => void; whip?: () => void; special?: () => void; hurt?: () => void };
  }
}
