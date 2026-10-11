use wasm_bindgen::prelude::*;

const MAX_ORBS: usize = 300;
const MAX_ENEMIES: usize = 250;
const MAX_ENEMIES_LOW: usize = 120;
const MAX_PARTICLES: usize = 500;
const CONTACT_DPS: f32 = 32.0;
const INVULN_SECONDS: f32 = 0.5;
const COMBO_WINDOW: f32 = 2.0;
const COMBO_CAP: u32 = 8;
// P1 wave director: 5-minute Hold Until Dawn arc.
const WIN_TIME: f32 = 300.0;
const TELEGRAPH_TIME: f32 = 1.0;
// Spawn warnings clear the HUD top bar (engine units == CSS px).
const HUD_CLEAR_Y: f32 = 76.0;
const MAX_TELEGRAPHS: usize = 20;

#[derive(Clone, Debug)]
pub struct Orb {
    pub id: u64,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub level: u8,
    pub radius: f32,
    pub mass: f32,
    pub is_merged: bool,
}

#[derive(Clone, Debug)]
pub struct Enemy {
    pub id: u64,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub radius: f32,
    pub speed: f32,
    pub kind: u8, // 0=grunt, 1=striker, 2=tank, 3=elite, 4=overlord, 5=cable thief, 6=boss
    pub frozen_until: f32,
}

#[derive(Clone, Debug)]
pub struct Telegraph {
    pub x: f32,
    pub y: f32,
    pub kind: u8,
    pub timer: f32,
}

#[derive(Clone, Debug)]
pub struct Beam {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub life: f32,
    pub max_life: f32,
}

#[derive(Clone, Debug)]
pub struct Energy {
    pub x: f32,
    pub y: f32,
    pub vy: f32,
    pub life: f32,
}

#[derive(Clone, Debug)]
pub struct Relay {
    pub id: u64,
    pub x: f32,
    pub y: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub cooldown: f32,
}

const BEAM_LIFE: f32 = 0.25;
const BEAM_HALF_WIDTH: f32 = 30.0;
const ENERGY_GAUGE_MAX: f32 = 100.0;
const ENERGY_PER_CELL: f32 = 10.0;
const MAX_ENERGY_CELLS: usize = 40;
const MAX_BEAMS: usize = 6;
// Friendly relays: a gauge sink for sustained fire. Static, breakable.
const RELAY_COST: f32 = 60.0;
const MAX_RELAYS: usize = 2;
const MAX_THIEVES: usize = 2;
// Cable thief: clamps onto the battery and siphons stored charge.
const THIEF_KIND: u8 = 5;
const THIEF_SIPHON_DPS: f32 = 8.0;
// Kariba Night Shift: one wave-5 boss per run. Slow, huge, heavy contact,
// and a death burst of harvestable charge worth the kill.
const BOSS_KIND: u8 = 6;
const BOSS_TELEGRAPH_TIME: f32 = 2.5;
const BOSS_ENERGY_BURST: usize = 8;
const BOSS_CONTACT_DPS: f32 = 10.0;
const MAX_BOSSES: usize = 1;
// Player maturity: each level hardens the battery and sharpens merge
// damage, answering enemy HP/speed scaling with level.
const LEVEL_HP_GAIN: f32 = 4.0;
const MATURITY_DMG_PER_LEVEL: f32 = 0.03;
const RELAY_RANGE: f32 = 220.0;
const RELAY_FIRE_INTERVAL: f32 = 1.5;
const RELAY_DAMAGE: f32 = 18.0;
const RELAY_BEAM_HALF_WIDTH: f32 = 18.0;
const RELAY_HP: f32 = 100.0;
const RELAY_RADIUS: f32 = 12.0;
// Grind, not vaporize: per-enemy contact rate, capped in total so a pile-on
// still takes seconds — a lone relay should win time, not die instantly.
const RELAY_TOUCH_DPS: f32 = 10.0;
const RELAY_MAX_INCOMING_DPS: f32 = 20.0;

/// Regulatory-style pity engine: variable-ratio drops with a hard
/// guarantee rail — no dry run longer than threshold-1 kills.
#[derive(Clone, Debug)]
pub struct MercyPityEngine {
    pub consecutive_failures: u32,
    pub hard_pity_threshold: u32,
    pub base_probability: f32,
}

impl MercyPityEngine {
    pub fn new(threshold: u32, base_prob: f32) -> Self {
        Self {
            consecutive_failures: 0,
            hard_pity_threshold: threshold.max(1),
            base_probability: base_prob.clamp(0.0, 1.0),
        }
    }

    pub fn evaluate_drop(&mut self, random_sample: f32) -> bool {
        self.consecutive_failures += 1;

        if self.consecutive_failures >= self.hard_pity_threshold {
            self.consecutive_failures = 0;
            return true;
        }

        let soft_start = self.hard_pity_threshold * 3 / 4;
        let effective = if self.consecutive_failures > soft_start {
            let k = (self.consecutive_failures - soft_start) as f32;
            (self.base_probability + k * 0.15).min(1.0)
        } else {
            self.base_probability
        };

        if random_sample <= effective {
            self.consecutive_failures = 0;
            true
        } else {
            false
        }
    }
}

/// Distance from point (px,py) to segment (x1,y1)-(x2,y2).
fn seg_dist(px: f32, py: f32, x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;
    if len_sq < 0.001 {
        return ((px - x1) * (px - x1) + (py - y1) * (py - y1)).sqrt();
    }
    let t = (((px - x1) * dx + (py - y1) * dy) / len_sq).clamp(0.0, 1.0);
    let cx = x1 + t * dx;
    let cy = y1 + t * dy;
    ((px - cx) * (px - cx) + (py - cy) * (py - cy)).sqrt()
}

#[derive(Clone, Debug)]
pub struct Particle {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
    pub max_life: f32,
    pub color_tier: u8,
}

fn orb_radius(level: u8) -> f32 {
    12.0 + (level.min(10) as f32) * 6.0
}

#[wasm_bindgen]
pub struct Universe {
    width: f32,
    height: f32,
    player_x: f32,
    player_target_x: f32,
    player_y: f32,
    player_hp: f32,
    player_max_hp: f32,
    invuln_timer: f32,
    score: u32,
    level: u32,
    xp: u32,
    next_xp: u32,
    // v1 rewards
    combo: u32,
    best_combo: u32,
    combo_timer: f32,
    merge_count: u32,
    last_merge_tier: u32,
    surge_timer: f32,
    freeze_timer: f32,
    pending_choices: u32,
    run_time: f32,
    // Upgrade effects (persist for run)
    beam_width_mult: f32,
    multi_shot_chance: f32,
    cryo_nova: bool,
    chain_lightning: bool,
    plasma_shield: bool,
    plasma_shield_regen: f32,
    overclock_speed: f32,
    magnet_radius_mult: f32,
    // run modes: 0=blitz 3min, 1=standard 5min, 2=endless
    mode: u8,
    total_time: f32,
    wave_len: f32,
    endless: bool,
    // adaptive
    perf_mode: u8, // 0=low, 1=normal, 2=high
    enemy_cap: usize,
    speed_scale: f32,
    hp_scale: f32,
    orbs: Vec<Orb>,
    enemies: Vec<Enemy>,
    particles: Vec<Particle>,
    telegraphs: Vec<Telegraph>,
    beams: Vec<Beam>,
    energies: Vec<Energy>,
    relays: Vec<Relay>,
    gauge: f32,
    // Grid stress 0..1: piled cells breed pressure. Smoothed; drives spawns.
    stress: f32,
    pity: MercyPityEngine,
    next_id: u64,
    frame_count: u64,
    seed: u64, // daily-grid spawn seed; 0 = unseeded variety
    boss_spawned: bool, // Kariba Night Shift enters once per run
    game_over: bool,
    victory: bool,
    wave: u32,
    render_buffer: Vec<f32>,
}

pub fn wave_for_time(t: f32) -> u32 {
    if t < 60.0 {
        1
    } else if t < 120.0 {
        2
    } else if t < 180.0 {
        3
    } else if t < 240.0 {
        4
    } else {
        5
    }
}

#[wasm_bindgen]
impl Universe {
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32) -> Universe {
        let w = if width.is_finite() { width.clamp(200.0, 1200.0) } else { 480.0 };
        let h = if height.is_finite() { height.clamp(320.0, 2400.0) } else { 800.0 };
        Universe {
            width: w,
            height: h,
            player_x: w * 0.5,
            player_target_x: w * 0.5,
            player_y: h - 72.0,
            player_hp: 100.0,
            player_max_hp: 100.0,
            invuln_timer: 0.0,
            score: 0,
            level: 1,
            xp: 0,
            next_xp: 100,
            combo: 0,
            best_combo: 0,
            combo_timer: 0.0,
            merge_count: 0,
            last_merge_tier: 0,
            surge_timer: 0.0,
            freeze_timer: 0.0,
            pending_choices: 0,
            run_time: 0.0,
            // Upgrade effects (persist for run)
            beam_width_mult: 1.0,
            multi_shot_chance: 0.0,
            cryo_nova: false,
            chain_lightning: false,
            plasma_shield: false,
            plasma_shield_regen: 0.0,
            overclock_speed: 1.0,
            magnet_radius_mult: 1.0,
            mode: 1,
            total_time: WIN_TIME,
            wave_len: 60.0,
            endless: false,
            perf_mode: 1,
            enemy_cap: MAX_ENEMIES,
            speed_scale: 1.0,
            hp_scale: 1.0,
            orbs: Vec::new(),
            enemies: Vec::new(),
            particles: Vec::new(),
            telegraphs: Vec::new(),
            beams: Vec::new(),
            energies: Vec::new(),
            relays: Vec::new(),
            gauge: 0.0,
            stress: 0.0,
            pity: MercyPityEngine::new(5, 0.8),
            next_id: 1,
            frame_count: 0,
            seed: 0,
            boss_spawned: false,
            game_over: false,
            victory: false,
            wave: 1,
            render_buffer: Vec::new(),
        }
    }

    pub fn drop_orb(&mut self, x: f32, level: u8) -> bool {
        if self.game_over || self.victory || self.orbs.len() >= MAX_ORBS {
            return false;
        }
        let x = if x.is_finite() { x } else { self.width * 0.5 };
        let level = level.clamp(1, 3);
        let clamped_x = x.clamp(30.0, (self.width - 30.0).max(30.0));
        let radius = orb_radius(level);
        let orb = Orb {
            id: self.next_id,
            x: clamped_x,
            y: 40.0,
            vx: 0.0,
            vy: 2.0,
            level,
            radius,
            mass: radius * radius,
            is_merged: false,
        };
        self.next_id += 1;
        self.orbs.push(orb);
        true
    }

    /// Charged drop: spends a full gauge (100) to deploy a level-4 cell.
    /// Returns true if fired. No-op when gauge is not full.
    pub fn drop_charged(&mut self, x: f32) -> bool {
        if self.game_over || self.gauge < ENERGY_GAUGE_MAX || self.orbs.len() >= MAX_ORBS {
            return false;
        }
        let x = if x.is_finite() { x } else { self.width * 0.5 };
        let clamped_x = x.clamp(30.0, (self.width - 30.0).max(30.0));
        let radius = orb_radius(4);
        self.orbs.push(Orb {
            id: self.next_id,
            x: clamped_x,
            y: 40.0,
            vx: 0.0,
            vy: 2.0,
            level: 4,
            radius,
            mass: radius * radius,
            is_merged: false,
        });
        self.next_id += 1;
        self.gauge = 0.0;
        true
    }

    pub fn get_gauge(&self) -> f32 {
        self.gauge
    }

    /// Deploy a friendly relay onto the cell floor. Costs a chunk of the
    /// gauge — the alternative spend is a charged level-4 drop — and caps at
    /// two. Relays pick off the nearest enemy in range on a fixed cadence and
    /// grind down if enemies reach them.
    pub fn deploy_relay(&mut self, x: f32) -> bool {
        if self.game_over || self.victory {
            return false;
        }
        if self.gauge < RELAY_COST || self.relays.len() >= MAX_RELAYS {
            return false;
        }
        let x = if x.is_finite() { x } else { self.width * 0.5 };
        let x = x.clamp(RELAY_RADIUS, (self.width - RELAY_RADIUS).max(RELAY_RADIUS));
        self.gauge -= RELAY_COST;
        self.relays.push(Relay {
            id: self.next_id,
            x,
            y: self.height - 100.0 - RELAY_RADIUS,
            hp: RELAY_HP,
            max_hp: RELAY_HP,
            // Brief arm delay so a fresh relay doesn't fire on the same tick.
            cooldown: 0.5,
        });
        self.next_id += 1;
        true
    }

    pub fn get_relay_count(&self) -> usize {
        self.relays.len()
    }

    pub fn get_player_x(&self) -> f32 { self.player_x }

    pub fn resize(&mut self, width: f32, height: f32) {
        if !width.is_finite() || !height.is_finite() { return; }
        let width = width.max(200.0);
        let height = height.max(320.0);
        let sx = width / self.width;
        let sy = height / self.height;
        self.player_x = (self.player_x * sx).clamp(20.0, width - 20.0);
        self.player_y = height - 72.0;
        self.player_target_x = (self.player_target_x * sx).clamp(20.0, width - 20.0);
        for orb in &mut self.orbs { orb.x *= sx; orb.y *= sy; }
        for enemy in &mut self.enemies { enemy.x *= sx; enemy.y *= sy; }
        for particle in &mut self.particles { particle.x *= sx; particle.y *= sy; }
        for telegraph in &mut self.telegraphs { telegraph.x *= sx; telegraph.y *= sy; }
        for beam in &mut self.beams {
            beam.x1 *= sx; beam.x2 *= sx; beam.y1 *= sy; beam.y2 *= sy;
        }
        for energy in &mut self.energies { energy.x *= sx; energy.y *= sy; }
        for relay in &mut self.relays { relay.x *= sx; relay.y *= sy; }
        self.width = width;
        self.height = height;
    }

    pub fn move_player(&mut self, target_x: f32) {
        if self.game_over || !target_x.is_finite() {
            return;
        }
        self.player_target_x = target_x.clamp(20.0, (self.width - 20.0).max(20.0));
    }

    /// Power-ups: 1=Solar Shield (+30 maxHP, heal 30), 2=Surge Burst (20s),
    /// 3=Freeze Schedule (12s). Consumes one pending choice if available.
    /// 4=Beam Width & Multi-Shot, 5=Cryo Nova, 6=Chain Lightning,
    /// 7=Plasma Shield Overcharge, 8=Overclock Speed & Magnet Radius.
    pub fn apply_powerup(&mut self, id: u8) {
        if self.game_over {
            return;
        }
        if self.pending_choices > 0 {
            self.pending_choices -= 1;
        }
        match id {
            1 => {
                self.player_max_hp += 30.0;
                self.player_hp = (self.player_hp + 30.0).min(self.player_max_hp);
            }
            2 => {
                self.surge_timer = 20.0;
            }
            3 => {
                self.freeze_timer = 12.0;
            }
            4 => {
                // Beam Width & Multi-Shot
                self.beam_width_mult *= 1.25;
                self.multi_shot_chance = (self.multi_shot_chance + 0.25).min(1.0);
            }
            5 => {
                // Cryo Nova
                self.cryo_nova = true;
            }
            6 => {
                // Chain Lightning Merges
                self.chain_lightning = true;
            }
            7 => {
                // Plasma Shield Overcharge
                self.plasma_shield = true;
                self.player_max_hp += 40.0;
                self.player_hp = (self.player_hp + 40.0).min(self.player_max_hp);
                self.plasma_shield_regen = 2.0;
            }
            8 => {
                // Overclock Speed & Magnet Radius
                self.overclock_speed *= 1.3;
                self.magnet_radius_mult *= 2.0;
            }
            _ => {}
        }
    }

    pub fn get_pending_choices(&self) -> u32 {
        self.pending_choices
    }

    /// Adaptive perf: 0=low (<28fps), 1=normal, 2=high (>50fps & level>=4).
    pub fn set_perf_mode(&mut self, mode: u8) {
        self.perf_mode = mode.min(2);
        match self.perf_mode {
            0 => {
                self.enemy_cap = MAX_ENEMIES_LOW;
                self.speed_scale = 0.8;
                self.hp_scale = 0.9;
            }
            2 => {
                self.enemy_cap = MAX_ENEMIES;
                self.speed_scale = 1.1;
                self.hp_scale = 1.1;
            }
            _ => {
                self.enemy_cap = MAX_ENEMIES;
                self.speed_scale = 1.0;
                self.hp_scale = 1.0;
            }
        }
    }

    /// Daily grid: pins the spawn pattern for a shared date seed.
    /// Call on a fresh universe before the run starts.
    pub fn set_seed(&mut self, seed: u64) {
        self.seed = seed;
    }

    /// Run modes: 0=blitz (180s), 1=standard (300s), 2=endless.
    /// Call on a fresh universe before the run starts.
    pub fn set_run_mode(&mut self, mode: u8) {
        self.mode = mode.min(2);
        match self.mode {
            0 => {
                self.total_time = 180.0;
                self.wave_len = 36.0;
                self.endless = false;
            }
            2 => {
                self.total_time = 1e9;
                self.wave_len = 60.0;
                self.endless = true;
            }
            _ => {
                self.total_time = WIN_TIME;
                self.wave_len = 60.0;
                self.endless = false;
            }
        }
        self.wave = 1;
    }

    /// Pre-run line check (loadout), picked in the menu — never mid-run.
    /// 1=Charged Cells (+50 gauge), 2=Reinforced Hull (+25 maxHP/heal),
    /// 3=Overclocked Coils (surge 10s).
    pub fn apply_loadout(&mut self, id: u8) {
        if self.game_over || self.run_time > 0.0 {
            return;
        }
        match id {
            1 => {
                self.gauge = (self.gauge + 50.0).min(ENERGY_GAUGE_MAX);
            }
            2 => {
                self.player_max_hp += 25.0;
                self.player_hp = (self.player_hp + 25.0).min(self.player_max_hp);
            }
            3 => {
                self.surge_timer = 10.0;
            }
            _ => {}
        }
    }

    fn wave_now(&self) -> u32 {
        ((self.run_time / self.wave_len) as u32 + 1).min(5).max(1)
    }

    /// Maturity multiplier on merge damage: +3% per level past the first.
    fn maturity_mult(&self) -> f32 {
        1.0 + MATURITY_DMG_PER_LEVEL * (self.level.saturating_sub(1) as f32)
    }

    /// Spawn mix by wave. Cable thieves appear from wave 3 and are capped —
    /// at most two on the field (live + incoming), extras downgrade to grunts.
    /// The Night Shift opens wave 5 exactly once; repeats downgrade to overlords.
    fn roll_spawn_kind(&self, roll: f32, interval: u64) -> u8 {
        let kind = match self.wave {
            1 => 0,
            2 => {
                if roll < 0.7 { 0 } else { 1 }
            }
            3 => {
                if roll < 0.5 {
                    0
                } else if roll < 0.75 {
                    1
                } else if roll < 0.9 {
                    2
                } else {
                    5
                }
            }
            4 => {
                if roll < 0.35 {
                    0
                } else if roll < 0.6 {
                    1
                } else if roll < 0.8 {
                    2
                } else if roll < 0.9 {
                    3
                } else {
                    5
                }
            }
            _ => {
                if !self.boss_spawned {
                    // The Night Shift opens wave 5: one entrance, then the mix.
                    6
                } else if self.frame_count % (interval * 5) == 0 {
                    4
                } else if roll < 0.35 {
                    0
                } else if roll < 0.6 {
                    1
                } else if roll < 0.8 {
                    2
                } else if roll < 0.9 {
                    3
                } else if roll < 0.95 {
                    5
                } else {
                    4
                }
            }
        };
        if kind == BOSS_KIND {
            let bosses = self.enemies.iter().filter(|e| e.kind == BOSS_KIND).count()
                + self.telegraphs.iter().filter(|t| t.kind == BOSS_KIND).count();
            if self.boss_spawned || bosses >= MAX_BOSSES {
                return 4;
            }
        }
        if kind == THIEF_KIND {
            let thieves = self.enemies.iter().filter(|e| e.kind == THIEF_KIND).count()
                + self.telegraphs.iter().filter(|t| t.kind == THIEF_KIND).count();
            if thieves >= MAX_THIEVES {
                return 0;
            }
        }
        kind
    }

    /// Endless overtime: minutes past 300s feed compounding pressure.
    fn overtime_mins(&self) -> f32 {
        ((self.run_time - WIN_TIME) / 60.0).max(0.0)
    }

    fn rand01(&mut self, salt: u64) -> f32 {
        // Cheap xorshift from frame counter — deterministic but well spread.
        // Mixed with the run seed so a daily grid replays its spawn pattern.
        let mut v = self.frame_count.wrapping_mul(6364136223846793005)
            ^ (salt.wrapping_mul(1442695040888963407))
            ^ self.next_id
            ^ self.seed;
        v ^= v >> 29;
        v = v.wrapping_mul(0xBF58476D1CE4E5B9);
        v ^= v >> 32;
        ((v & 0xFFFF_FFFF) as f32) / (u32::MAX as f32)
    }

    pub fn tick(&mut self, dt: f32) {
        if self.game_over || self.victory {
            return;
        }
        let dt = if dt.is_finite() { dt.clamp(0.0, 0.05) } else { 0.016 };
        if dt <= 0.0 {
            return;
        }
        self.frame_count += 1;
        self.run_time += dt;
        // Time-based pursuit: input updates a target; physics owns motion.
        let distance = self.player_target_x - self.player_x;
        let step = 520.0 * self.overclock_speed.min(3.0) * dt;
        self.player_x += distance.clamp(-step, step);
        if self.invuln_timer > 0.0 {
            self.invuln_timer -= dt;
        }
        if self.combo_timer > 0.0 {
            self.combo_timer -= dt;
            if self.combo_timer <= 0.0 {
                self.combo = 0;
                self.combo_timer = 0.0;
            }
        }
        if self.surge_timer > 0.0 {
            self.surge_timer -= dt;
        }
        if self.freeze_timer > 0.0 {
            self.freeze_timer -= dt;
        }

        // Plasma Shield regen: 2 HP/sec while above 50% HP
        if self.plasma_shield && self.player_hp > self.player_max_hp * 0.5 {
            self.player_hp = (self.player_hp + self.plasma_shield_regen * dt).min(self.player_max_hp);
        }

        // Victory: Hold Until Dawn (finite modes only).
        self.wave = self.wave_now();
        if !self.endless && self.run_time >= self.total_time {
            self.victory = true;
            return;
        }

        // 1. Wave director: telegraphed spawns, escalating interval + mix.
        // Telegraph first (1s warning), then materialize.
        for t in self.telegraphs.iter_mut() {
            t.timer -= dt;
        }
        let mut due = Vec::new();
        self.telegraphs.retain(|t| {
            if t.timer <= 0.0 {
                due.push((t.x, t.y, t.kind));
                false
            } else {
                true
            }
        });
        for (ex, ey, kind) in due {
            if self.enemies.len() >= self.enemy_cap {
                continue;
            }
            let (hp_mul, sp_mul, radius) = match kind {
                1 => (0.7, 1.6, 8.0),   // striker
                2 => (3.0, 0.55, 16.0), // tank
                3 => (6.0, 0.8, 14.0),  // elite
                4 => (25.0, 0.5, 26.0), // overlord
                5 => (0.5, 1.9, 8.0),   // cable thief: fast, fragile
                6 => (40.0, 0.35, 34.0), // Kariba Night Shift: slow siege
                _ => (1.0, 1.0, 10.0),  // grunt
            };
            if kind == 4 && self.enemies.iter().filter(|e| e.kind == 4).count() >= 3 {
                continue;
            }
            // Endless overtime compounds pressure past 300s.
            let ot = self.overtime_mins();
            let hp = (12.0 + (self.level as f32) * 3.0) * self.hp_scale * hp_mul * (1.0 + ot * 0.15);
            self.enemies.push(Enemy {
                id: self.next_id,
                x: ex,
                y: ey,
                vx: 0.0,
                vy: 0.0,
                hp,
                max_hp: hp,
                radius,
                speed: (48.0 + (self.level as f32) * 2.5) * self.speed_scale * sp_mul * (1.0 + self.overtime_mins() * 0.03),
                kind,
                frozen_until: 0.0,
            });
            self.next_id += 1;
        }

        // Grid stress: cells piled above the 40% line breed pressure. Fresh
        // drops transit the zone in under a second; smoothing (~0.5s tau)
        // keeps them from registering, but a real pile pins it at 1.
        let stress_line = self.height * 0.4;
        let piled = self.orbs.iter().filter(|o| o.y < stress_line).count();
        let stress_target = ((piled as f32) / 6.0).min(1.0);
        self.stress += (stress_target - self.stress) * (dt * 2.0).min(1.0);

        // Playtest #1 (victory, "too easy", smooth fps): tightened ~20%.
        let base_interval: u64 = match self.wave {
            1 => 36,
            2 => 30,
            3 => 26,
            4 => 22,
            _ => 18,
        };
        // Mid-run surge events: spawn twice as fast during crunch windows.
        // Crunch windows scale with mode length (5/6 and 23/30 of total).
        let crunch = |t: f32| {
            (t >= self.total_time * 0.5 && t < self.total_time * 0.5 + 20.0)
                || (t >= self.total_time * 0.77 && t < self.total_time * 0.77 + 20.0)
        };
        let in_surge = !self.endless && crunch(self.run_time);
        let ot_mins = self.overtime_mins() as u64;
        let interval = if in_surge { base_interval / 2 } else { base_interval }
            .saturating_sub(ot_mins * 2)
            .clamp(6, 60);
        // Stressed grid spawns up to twice as fast — merge the pile down.
        let interval = ((interval as f32 * (1.0 - 0.5 * self.stress)).round() as u64).max(6);
        if self.frame_count % interval == 0
            && self.enemies.len() + self.telegraphs.len() < self.enemy_cap
            && self.telegraphs.len() < MAX_TELEGRAPHS
        {
            let r = self.rand01(7);
            let (ex, ey) = if r < 0.6 {
                (r / 0.6 * self.width, 10.0)
            } else if r < 0.8 {
                (10.0, self.rand01(11) * self.height * 0.6)
            } else {
                (self.width - 10.0, self.rand01(13) * self.height * 0.6)
            };
            let roll = self.rand01(29);
            let kind = self.roll_spawn_kind(roll, interval);
            if kind == BOSS_KIND {
                self.boss_spawned = true;
            }
            self.telegraphs.push(Telegraph {
                x: ex,
                // Warnings must read: the HUD covers the top ~60px, and side
                // spawns near the corners hide under it too.
                y: ey.max(HUD_CLEAR_Y),
                kind,
                timer: if kind == BOSS_KIND { BOSS_TELEGRAPH_TIME } else { TELEGRAPH_TIME },
            });
        }

        // Adaptive cell substeps limit travel to less than half the smallest radius.
        let min_radius = self.orbs.iter().map(|o| o.radius).fold(18.0_f32, f32::min);
        let max_speed = self.orbs.iter().map(|o| (o.vx * o.vx + o.vy * o.vy).sqrt()).fold(0.0_f32, f32::max);
        let steps = (((max_speed + 350.0 * dt) * dt / (min_radius * 0.45)).ceil() as usize).clamp(1, 16);
        for _ in 0..steps { self.step_cells(dt / steps as f32); }

        // 4. Update enemies (seek player, capped contact DPS + invuln window)
        let px = self.player_x;
        let py = self.player_y;
        let freeze_mult = if self.freeze_timer > 0.0 { 0.6 } else { 1.0 };
        let mut touching = 0u32;
        let mut thieves_touching = 0u32;
        let mut boss_touching = 0u32;
        for enemy in self.enemies.iter_mut() {
            let dx = px - enemy.x;
            let dy = py - enemy.y;
            let dist = (dx * dx + dy * dy).sqrt().max(0.001);
            let cryo_mult = if enemy.frozen_until > self.run_time { 0.0 } else { 1.0 };
            enemy.vx = (dx / dist) * enemy.speed * freeze_mult * cryo_mult;
            enemy.vy = (dy / dist) * enemy.speed * freeze_mult * cryo_mult;
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;

            if dist < enemy.radius + 15.0 {
                touching += 1;
                if enemy.kind == THIEF_KIND {
                    thieves_touching += 1;
                }
                if enemy.kind == BOSS_KIND {
                    boss_touching += 1;
                }
            }
        }

        if touching > 0 && self.invuln_timer <= 0.0 {
            // Flat DPS regardless of stack size — prevents instant death.
            self.player_hp -= CONTACT_DPS * dt * (1.0 + (touching.min(5) as f32) * 0.15);
            self.invuln_timer = 0.0; // continuous DPS; invuln gates burst hits below
            if self.player_hp <= 0.0 {
                self.player_hp = 0.0;
                self.game_over = true;
            }
        }
        // Cable thieves siphon stored charge while clamped on — gauge, not HP.
        if thieves_touching > 0 {
            self.gauge = (self.gauge - THIEF_SIPHON_DPS * thieves_touching as f32 * dt).max(0.0);
        }
        // The Night Shift hits heavy up close, on top of capped contact DPS.
        if boss_touching > 0 && !self.game_over {
            self.player_hp -= BOSS_CONTACT_DPS * boss_touching as f32 * dt;
            if self.player_hp <= 0.0 {
                self.player_hp = 0.0;
                self.game_over = true;
            }
        }
        let _ = INVULN_SECONDS;

        // 4b. Friendly relays: grind under contact, then fire on the nearest
        // enemy in range. Collected first so relay kills still drop energy.
        let mut relay_shots: Vec<(f32, f32, f32, f32)> = Vec::new();
        let mut relay_deaths: Vec<(f32, f32)> = Vec::new();
        for relay in self.relays.iter_mut() {
            let mut incoming = 0.0;
            for enemy in self.enemies.iter() {
                let dx = enemy.x - relay.x;
                let dy = enemy.y - relay.y;
                let touch = enemy.radius + RELAY_RADIUS;
                if dx * dx + dy * dy <= touch * touch {
                    incoming += RELAY_TOUCH_DPS * dt;
                }
            }
            relay.hp -= incoming.min(RELAY_MAX_INCOMING_DPS * dt);
            if relay.hp <= 0.0 {
                relay_deaths.push((relay.x, relay.y));
                continue;
            }
            relay.cooldown -= dt;
            if relay.cooldown > 0.0 {
                continue;
            }
            let mut best: Option<(f32, f32, f32)> = None; // (dist_sq, x, y)
            for enemy in self.enemies.iter() {
                if enemy.hp <= 0.0 {
                    continue;
                }
                let dx = enemy.x - relay.x;
                let dy = enemy.y - relay.y;
                let d2 = dx * dx + dy * dy;
                if d2 > RELAY_RANGE * RELAY_RANGE {
                    continue;
                }
                if best.map_or(true, |(bd, _, _)| d2 < bd) {
                    best = Some((d2, enemy.x, enemy.y));
                }
            }
            if let Some((_, ex, ey)) = best {
                relay.cooldown = RELAY_FIRE_INTERVAL;
                relay_shots.push((relay.x, relay.y, ex, ey));
            }
        }
        self.relays.retain(|r| r.hp > 0.0);
        // Fallen relays burst into sparks so the loss reads on the field.
        for (dx, dy) in relay_deaths {
            for k in 0..10 {
                if self.particles.len() >= MAX_PARTICLES {
                    break;
                }
                let angle = (k as f32) * 6.28318 / 10.0;
                self.particles.push(Particle {
                    x: dx,
                    y: dy,
                    vx: angle.cos() * 140.0,
                    vy: angle.sin() * 140.0,
                    life: 0.5,
                    max_life: 0.5,
                    color_tier: 7,
                });
            }
        }
        for (x1, y1, x2, y2) in relay_shots {
            for enemy in self.enemies.iter_mut() {
                if seg_dist(enemy.x, enemy.y, x1, y1, x2, y2) <= RELAY_BEAM_HALF_WIDTH {
                    enemy.hp -= RELAY_DAMAGE;
                }
            }
            if self.beams.len() < MAX_BEAMS {
                self.beams.push(Beam {
                    x1,
                    y1,
                    x2,
                    y2,
                    life: BEAM_LIFE,
                    max_life: BEAM_LIFE,
                });
            }
        }

        // P2: kills drop harvestable energy cells via pity engine.
        // A fallen boss bursts a ring of charge worth the kill.
        let mut dead: Vec<(f32, f32, u8)> = Vec::new();
        self.enemies.retain(|e| {
            if e.hp > 0.0 {
                true
            } else {
                dead.push((e.x, e.y, e.kind));
                false
            }
        });
        for (i, (dx, dy, kind)) in dead.into_iter().enumerate() {
            if self.energies.len() >= MAX_ENERGY_CELLS {
                break;
            }
            let sample = self.rand01(1000 + i as u64);
            if self.pity.evaluate_drop(sample) {
                self.energies.push(Energy { x: dx, y: dy, vy: 60.0, life: 8.0 });
            }
            if kind == BOSS_KIND {
                for k in 0..BOSS_ENERGY_BURST {
                    if self.energies.len() >= MAX_ENERGY_CELLS {
                        break;
                    }
                    let angle = (k as f32) * 6.28318 / (BOSS_ENERGY_BURST as f32);
                    self.energies.push(Energy {
                        x: dx + angle.cos() * 30.0,
                        y: dy + angle.sin() * 30.0,
                        vy: 60.0,
                        life: 8.0,
                    });
                }
                for k in 0..20 {
                    if self.particles.len() >= MAX_PARTICLES {
                        break;
                    }
                    let angle = (k as f32) * 6.28318 / 20.0;
                    self.particles.push(Particle {
                        x: dx,
                        y: dy,
                        vx: angle.cos() * 180.0,
                        vy: angle.sin() * 180.0,
                        life: 0.7,
                        max_life: 0.7,
                        color_tier: 8,
                    });
                }
            }
        }

        // 5. Update particles
        for p in self.particles.iter_mut() {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        self.particles.retain(|p| p.life > 0.0);

        // 6. Beams fade; energy drifts down and is harvested on touch.
        for b in self.beams.iter_mut() {
            b.life -= dt;
        }
        self.beams.retain(|b| b.life > 0.0);
        let ppx = self.player_x;
        let ppy = self.player_y;
        let floor = self.height - 100.0;
        for e in self.energies.iter_mut() {
            e.y += e.vy * dt;
            e.life -= dt;
            if e.y > floor {
                e.y = floor;
            }
        }
        let mut harvested = 0u32;
        let magnet_radius = 36.0 * self.magnet_radius_mult;
        let magnet_radius_sq = magnet_radius * magnet_radius;
        self.energies.retain(|e| {
            if e.life <= 0.0 {
                return false;
            }
            let dx = e.x - ppx;
            let dy = e.y - ppy;
            if dx * dx + dy * dy <= magnet_radius_sq {
                harvested += 1;
                false
            } else {
                true
            }
        });
        if harvested > 0 {
            self.gauge = (self.gauge + harvested as f32 * ENERGY_PER_CELL).min(ENERGY_GAUGE_MAX);
        }
    }

    fn step_cells(&mut self, dt: f32) {
        // 2. Physics update for Orbs
        let gravity = 350.0;
        let floor = self.height - 100.0;
        for orb in self.orbs.iter_mut() {
            orb.vy = (orb.vy + gravity * dt).min(900.0);
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;
            orb.vx *= (-0.35 * dt).exp();

            if orb.x - orb.radius < 0.0 {
                orb.x = orb.radius;
                orb.vx *= -0.4;
            } else if orb.x + orb.radius > self.width {
                orb.x = self.width - orb.radius;
                orb.vx *= -0.4;
            }
            if orb.y + orb.radius > floor {
                orb.y = floor - orb.radius;
                orb.vy = if orb.vy > 35.0 { -orb.vy * 0.18 } else { 0.0 };
                orb.vx *= (-9.0 * dt).exp();
            }
        }

        // 3. Resolve Orb-Orb collisions & merging
        let mut new_orbs = Vec::new();
        let orb_len = self.orbs.len();
        for i in 0..orb_len {
            if self.orbs[i].is_merged {
                continue;
            }
            for j in (i + 1)..orb_len {
                if self.orbs[j].is_merged {
                    continue;
                }
                let dx = self.orbs[j].x - self.orbs[i].x;
                let dy = self.orbs[j].y - self.orbs[i].y;
                let dist_sq = dx * dx + dy * dy;
                let min_dist = self.orbs[i].radius + self.orbs[j].radius;

                if dist_sq < min_dist * min_dist {
                    let dist = dist_sq.sqrt().max(0.001);
                    let nx = if dist_sq <= 0.001 { 1.0 } else { dx / dist };
                    let ny = if dist_sq <= 0.001 { 0.0 } else { dy / dist };

                    if self.orbs[i].level == self.orbs[j].level {
                        self.orbs[i].is_merged = true;
                        self.orbs[j].is_merged = true;

                        let next_level = (self.orbs[i].level + 1).min(10);
                        let mid_x = (self.orbs[i].x + self.orbs[j].x) * 0.5;
                        let mid_y = (self.orbs[i].y + self.orbs[j].y) * 0.5;
                        let radius = orb_radius(next_level);

                        new_orbs.push(Orb {
                            id: self.next_id,
                            x: mid_x,
                            y: mid_y,
                            vx: (self.orbs[i].vx * self.orbs[i].mass + self.orbs[j].vx * self.orbs[j].mass) / (self.orbs[i].mass + self.orbs[j].mass) * 0.75,
                            vy: ((self.orbs[i].vy * self.orbs[i].mass + self.orbs[j].vy * self.orbs[j].mass) / (self.orbs[i].mass + self.orbs[j].mass) * 0.75 - 24.0).clamp(-180.0, 600.0),
                            level: next_level,
                            radius,
                            mass: radius * radius,
                            is_merged: false,
                        });
                        self.next_id += 1;
                        // A restrained discharge pushes neighbouring cells, not the entire pile.
                        for k in 0..orb_len {
                            if k == i || k == j || self.orbs[k].is_merged { continue; }
                            let dx = self.orbs[k].x - mid_x;
                            let dy = self.orbs[k].y - mid_y;
                            let distance = (dx * dx + dy * dy).sqrt().max(1.0);
                            if distance < 100.0 {
                                let kick = 38.0 * (1.0 - distance / 100.0);
                                self.orbs[k].vx += dx / distance * kick;
                                self.orbs[k].vy += dy / distance * kick;
                            }
                        }
                        // Merge shockwave: consumed-tier neighbours surf toward the
                        // crater at distance-proportional speed, so they arrive
                        // together — the seed of chain reactions.
                        let consumed = next_level.saturating_sub(1).max(1);
                        let pull_radius = 100.0 + 20.0 * (next_level as f32);
                        for k in 0..orb_len {
                            if k == i || k == j || self.orbs[k].is_merged { continue; }
                            if self.orbs[k].level != consumed { continue; }
                            let dx = mid_x - self.orbs[k].x;
                            let dy = mid_y - self.orbs[k].y;
                            let distance = (dx * dx + dy * dy).sqrt();
                            if distance < 1.0 || distance > pull_radius { continue; }
                            let sp = (distance * 1.5).min(220.0);
                            self.orbs[k].vx += dx / distance * sp;
                            self.orbs[k].vy += dy / distance * sp;
                        }

                        // Combo: chain merges inside window.
                        if self.combo_timer > 0.0 {
                            self.combo += 1;
                        } else {
                            self.combo = 1;
                        }
                        self.combo_timer = COMBO_WINDOW;
                        if self.combo > self.best_combo {
                            self.best_combo = self.combo;
                        }
                        let mult = self.combo.min(COMBO_CAP);
                        self.merge_count += 1;
                        self.last_merge_tier = next_level as u32;

                        self.score += (next_level as u32) * 50 * mult;
                        self.xp += (next_level as u32) * 20;
                        if self.xp >= self.next_xp {
                            self.level += 1;
                            self.xp = 0;
                            self.next_xp = (self.next_xp as f32 * 1.5) as u32;
                            self.pending_choices += 1;
                            self.player_max_hp += LEVEL_HP_GAIN;
                            self.player_hp =
                                (self.player_hp + 20.0).min(self.player_max_hp);
                        }

                        // Radial explosion — one particle per direction.
                        if self.particles.len() < MAX_PARTICLES {
                            let n = 12usize;
                            for k in 0..n {
                                if self.particles.len() >= MAX_PARTICLES {
                                    break;
                                }
                                let angle =
                                    (k as f32) * 6.28318 / (n as f32);
                                self.particles.push(Particle {
                                    x: mid_x,
                                    y: mid_y,
                                    vx: angle.cos() * 120.0,
                                    vy: angle.sin() * 120.0,
                                    life: 0.4,
                                    max_life: 0.4,
                                    color_tier: next_level,
                                });
                            }
                        }

                        // Area damage to nearby enemies (Surge x1.5, maturity +3%/level)
                        let surge_mult = if self.surge_timer > 0.0 { 1.5 } else { 1.0 };
                        let burst_radius =
                            (80.0 + (next_level as f32) * 20.0) * surge_mult;
                        let damage =
                            (30.0 + (next_level as f32) * 25.0) * surge_mult * self.maturity_mult();
                        for enemy in self.enemies.iter_mut() {
                            let edx = enemy.x - mid_x;
                            let edy = enemy.y - mid_y;
                            if edx * edx + edy * edy
                                <= burst_radius * burst_radius
                            {
                                enemy.hp -= damage;
                            }
                        }

                        // Cryo Nova: freeze enemies in 120px radius for 2s
                        if self.cryo_nova {
                            let cryo_radius = 120.0;
                            for enemy in self.enemies.iter_mut() {
                                let edx = enemy.x - mid_x;
                                let edy = enemy.y - mid_y;
                                if edx * edx + edy * edy <= cryo_radius * cryo_radius {
                                    enemy.frozen_until = self.run_time + 2.0;
                                }
                            }
                        }

                        // Chain Lightning: arcs jump to 2 nearby enemies
                        if self.chain_lightning {
                            let mut targets: Vec<&mut Enemy> = self.enemies.iter_mut()
                                .filter(|e| {
                                    let edx = e.x - mid_x;
                                    let edy = e.y - mid_y;
                                    edx * edx + edy * edy <= 200.0 * 200.0
                                })
                                .collect();
                            // Sort by distance, take closest 2
                            targets.sort_by(|a, b| {
                                let da = (a.x - mid_x).powi(2) + (a.y - mid_y).powi(2);
                                let db = (b.x - mid_x).powi(2) + (b.y - mid_y).powi(2);
                                da.partial_cmp(&db).unwrap()
                            });
                            for enemy in targets.iter_mut().take(2) {
                                enemy.hp -= damage * 0.6;
                            }
                        }

                        // P2: directional beam — merge discharge fires toward
                        // the battery. Position matters: merge above threats.
                        let bx2 = self.player_x;
                        let by2 = self.player_y;

                        // Primary beam
                        let beam_half_width = BEAM_HALF_WIDTH * self.beam_width_mult;
                        for enemy in self.enemies.iter_mut() {
                            if seg_dist(enemy.x, enemy.y, mid_x, mid_y, bx2, by2)
                                <= beam_half_width
                            {
                                enemy.hp -= damage;
                            }
                        }
                        if self.beams.len() < MAX_BEAMS {
                            self.beams.push(Beam {
                                x1: mid_x,
                                y1: mid_y,
                                x2: bx2,
                                y2: by2,
                                life: BEAM_LIFE,
                                max_life: BEAM_LIFE,
                            });
                        }

                        // Multi-shot: chance for parallel beam offset
                        if self.multi_shot_chance > 0.0 && self.rand01(9999) < self.multi_shot_chance {
                            let offset = 40.0; // pixels to side
                            let bx3 = bx2 + offset;
                            let by3 = by2;
                            for enemy in self.enemies.iter_mut() {
                                if seg_dist(enemy.x, enemy.y, mid_x, mid_y, bx3, by3)
                                    <= beam_half_width
                                {
                                    enemy.hp -= damage * 0.8;
                                }
                            }
                            if self.beams.len() < MAX_BEAMS {
                                self.beams.push(Beam {
                                    x1: mid_x,
                                    y1: mid_y,
                                    x2: bx3,
                                    y2: by3,
                                    life: BEAM_LIFE,
                                    max_life: BEAM_LIFE,
                                });
                            }
                        }

                        break;
                    } else {
                        let relative_normal = (self.orbs[j].vx - self.orbs[i].vx) * nx
                            + (self.orbs[j].vy - self.orbs[i].vy) * ny;
                        if relative_normal < 0.0 {
                            let inv_i = 1.0 / self.orbs[i].mass;
                            let inv_j = 1.0 / self.orbs[j].mass;
                            let impulse = -(1.0 + 0.12) * relative_normal / (inv_i + inv_j);
                            self.orbs[i].vx -= impulse * inv_i * nx;
                            self.orbs[i].vy -= impulse * inv_i * ny;
                            self.orbs[j].vx += impulse * inv_j * nx;
                            self.orbs[j].vy += impulse * inv_j * ny;
                            let tx = -ny;
                            let ty = nx;
                            let tangent = (self.orbs[j].vx - self.orbs[i].vx) * tx
                                + (self.orbs[j].vy - self.orbs[i].vy) * ty;
                            let friction = (-tangent / (inv_i + inv_j)).clamp(-impulse * 0.22, impulse * 0.22);
                            self.orbs[i].vx -= friction * inv_i * tx;
                            self.orbs[i].vy -= friction * inv_i * ty;
                            self.orbs[j].vx += friction * inv_j * tx;
                            self.orbs[j].vy += friction * inv_j * ty;
                        }
                        let overlap = min_dist - dist;
                        let total_mass =
                            self.orbs[i].mass + self.orbs[j].mass;
                        self.orbs[i].x -=
                            nx * overlap * (self.orbs[j].mass / total_mass);
                        self.orbs[i].y -=
                            ny * overlap * (self.orbs[j].mass / total_mass);
                        self.orbs[j].x +=
                            nx * overlap * (self.orbs[i].mass / total_mass);
                        self.orbs[j].y +=
                            ny * overlap * (self.orbs[i].mass / total_mass);
                    }
                }
            }
        }

        self.orbs.retain(|o| !o.is_merged);
        for o in new_orbs {
            if self.orbs.len() < MAX_ORBS {
                self.orbs.push(o);
            }
        }

        // Additional constraint passes keep dense piles from interpenetrating.
        for _ in 0..3 {
            for i in 0..self.orbs.len() {
                for j in i + 1..self.orbs.len() {
                    let dx = self.orbs[j].x - self.orbs[i].x;
                    let dy = self.orbs[j].y - self.orbs[i].y;
                    let distance = (dx * dx + dy * dy).sqrt().max(0.001);
                    let overlap = self.orbs[i].radius + self.orbs[j].radius - distance;
                    if overlap <= 0.1 || self.orbs[i].level == self.orbs[j].level { continue; }
                    let nx = if distance <= 0.001 { 1.0 } else { dx / distance };
                    let ny = if distance <= 0.001 { 0.0 } else { dy / distance };
                    let total = self.orbs[i].mass + self.orbs[j].mass;
                    let wi = self.orbs[j].mass / total;
                    let wj = self.orbs[i].mass / total;
                    self.orbs[i].x -= nx * overlap * wi;
                    self.orbs[i].y -= ny * overlap * wi;
                    self.orbs[j].x += nx * overlap * wj;
                    self.orbs[j].y += ny * overlap * wj;
                }
            }
            for cell in &mut self.orbs {
                cell.x = cell.x.clamp(cell.radius, (self.width - cell.radius).max(cell.radius));
                cell.y = cell.y.min(self.height - 100.0 - cell.radius);
            }
        }
    }

    /// Packed render data. Header (35 floats, append-only; 0..16 stable):
    /// [orb_count, enemy_count, particle_count, player_x, player_y,
    ///  player_hp, player_max_hp, score, level, xp, next_xp,
    ///  combo, combo_frac, best_combo, pending_choices, surge_left, freeze_left,
    ///  wave, time_left, victory, telegraph_count, merge_count,
    ///  last_merge_tier, gauge, beam_count, energy_count,
    ///  beam_width_mult, multi_shot_chance, cryo_nova, chain_lightning,
    ///  plasma_shield, overclock_speed, magnet_radius_mult, relay_count, stress]
    /// Orbs: x, y, level, radius (4 each)
    /// Enemies: x, y, hp_percent, kind (4 each)
    /// Particles: x, y, life_percent, color_tier (4 each)
    /// Telegraphs: x, y, warn_frac (3 each)
    /// Beams: x1, y1, x2, y2, life_frac (5 each)
    /// Energies: x, y (2 each)
    /// Relays: x, y, hp_percent, cooldown_frac (4 each)
    ///
    /// NOTE: pointer is only valid until the next &mut call or
    /// memory.grow. Callers must copy the slice immediately and must
    /// re-create the Float32Array view each frame.
    pub fn get_render_data(&mut self) -> *const f32 {
        self.render_buffer.clear();
        self.render_buffer.push(self.orbs.len() as f32);
        self.render_buffer.push(self.enemies.len() as f32);
        self.render_buffer.push(self.particles.len() as f32);
        self.render_buffer.push(self.player_x);
        self.render_buffer.push(self.player_y);
        self.render_buffer.push(self.player_hp);
        self.render_buffer.push(self.player_max_hp);
        self.render_buffer.push(self.score as f32);
        self.render_buffer.push(self.level as f32);
        self.render_buffer.push(self.xp as f32);
        self.render_buffer.push(self.next_xp as f32);
        self.render_buffer.push(self.combo as f32);
        self.render_buffer.push((self.combo_timer / COMBO_WINDOW).clamp(0.0, 1.0));
        self.render_buffer.push(self.best_combo as f32);
        self.render_buffer.push(self.pending_choices as f32);
        self.render_buffer.push(self.surge_timer.max(0.0));
        self.render_buffer.push(self.freeze_timer.max(0.0));
        self.render_buffer.push(self.wave as f32);
        self.render_buffer.push((self.total_time - self.run_time).max(0.0));
        self.render_buffer.push(if self.victory { 1.0 } else { 0.0 });
        self.render_buffer.push(self.telegraphs.len() as f32);
        self.render_buffer.push(self.merge_count as f32);
        self.render_buffer.push(self.last_merge_tier as f32);
        self.render_buffer.push(self.gauge);
        self.render_buffer.push(self.beams.len() as f32);
        self.render_buffer.push(self.energies.len() as f32);
        // Upgrade fields (indices 26-32)
        self.render_buffer.push(self.beam_width_mult);
        self.render_buffer.push(self.multi_shot_chance);
        self.render_buffer.push(if self.cryo_nova { 1.0 } else { 0.0 });
        self.render_buffer.push(if self.chain_lightning { 1.0 } else { 0.0 });
        self.render_buffer.push(if self.plasma_shield { 1.0 } else { 0.0 });
        self.render_buffer.push(self.overclock_speed);
        self.render_buffer.push(self.magnet_radius_mult);
        self.render_buffer.push(self.relays.len() as f32);
        self.render_buffer.push(self.stress);

        for orb in &self.orbs {
            self.render_buffer.push(orb.x);
            self.render_buffer.push(orb.y);
            self.render_buffer.push(orb.level as f32);
            self.render_buffer.push(orb.radius);
        }

        for enemy in &self.enemies {
            self.render_buffer.push(enemy.x);
            self.render_buffer.push(enemy.y);
            self.render_buffer.push((enemy.hp / enemy.max_hp).clamp(0.0, 1.0));
            self.render_buffer.push(enemy.kind as f32);
        }

        for p in &self.particles {
            self.render_buffer.push(p.x);
            self.render_buffer.push(p.y);
            self.render_buffer.push(p.life / p.max_life);
            self.render_buffer.push(p.color_tier as f32);
        }

        for t in &self.telegraphs {
            self.render_buffer.push(t.x);
            self.render_buffer.push(t.y);
            self.render_buffer.push((1.0 - t.timer / if t.kind == BOSS_KIND { BOSS_TELEGRAPH_TIME } else { TELEGRAPH_TIME }).clamp(0.0, 1.0));
        }

        for b in &self.beams {
            self.render_buffer.push(b.x1);
            self.render_buffer.push(b.y1);
            self.render_buffer.push(b.x2);
            self.render_buffer.push(b.y2);
            self.render_buffer.push((b.life / b.max_life).clamp(0.0, 1.0));
        }

        for e in &self.energies {
            self.render_buffer.push(e.x);
            self.render_buffer.push(e.y);
        }

        for r in &self.relays {
            self.render_buffer.push(r.x);
            self.render_buffer.push(r.y);
            self.render_buffer.push((r.hp / r.max_hp).clamp(0.0, 1.0));
            self.render_buffer.push((r.cooldown.max(0.0) / RELAY_FIRE_INTERVAL).clamp(0.0, 1.0));
        }

        self.render_buffer.as_ptr()
    }

    pub fn get_render_data_len(&self) -> usize {
        self.render_buffer.len()
    }

    pub fn is_game_over(&self) -> bool {
        self.game_over
    }

    pub fn is_victory(&self) -> bool {
        self.victory
    }

    pub fn get_score(&self) -> u32 {
        self.score
    }

    pub fn get_level(&self) -> u32 {
        self.level
    }

    pub fn get_wave(&self) -> u32 {
        self.wave
    }

    pub fn get_merge_count(&self) -> u32 {
        self.merge_count
    }

    pub fn get_run_time(&self) -> f32 {
        self.run_time
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_level_orbs_merge_and_score() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        // Identical drop positions must merge without a collision normal.
        u.tick(0.016);
        assert_eq!(u.orbs.len(), 1);
        assert_eq!(u.orbs[0].level, 2);
        assert!(u.score > 0);
    }

    #[test]
    fn caps_are_enforced() {
        let mut u = Universe::new(480.0, 800.0);
        for i in 0..400 {
            u.drop_orb(50.0 + (i % 380) as f32, 1);
        }
        assert!(u.orbs.len() <= MAX_ORBS);
    }

    #[test]
    fn contact_damage_is_capped_not_instant() {
        let mut u = Universe::new(480.0, 800.0);
        for _ in 0..100 {
            u.enemies.push(Enemy {
                id: 1,
                x: u.player_x,
                y: u.player_y,
                vx: 0.0,
                vy: 0.0,
                hp: 100.0,
                max_hp: 100.0,
                radius: 10.0,
                speed: 0.0,
                kind: 0,
                frozen_until: 0.0,
            });
        }
        u.tick(0.016);
        assert!(!u.is_game_over());
        assert!(u.player_hp > 50.0);
    }

    #[test]
    fn combo_chains_and_resets() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = u.orbs[0].y + 1.0;
        u.tick(0.016);
        assert_eq!(u.combo, 1);
        // Second merge inside window -> combo 2
        u.drop_orb(200.0, 1);
        u.drop_orb(200.0, 1);
        let n = u.orbs.len();
        u.orbs[n - 1].x = u.orbs[n - 2].x + 1.0;
        u.orbs[n - 1].y = u.orbs[n - 2].y + 1.0;
        u.tick(0.016);
        assert_eq!(u.combo, 2);
        assert_eq!(u.best_combo, 2);
        // Timeout -> reset (dt clamps to 0.05, so tick repeatedly)
        for _ in 0..50 {
            u.tick(0.05);
        }
        assert_eq!(u.combo, 0);
    }

    #[test]
    fn powerups_apply() {
        let mut u = Universe::new(480.0, 800.0);
        u.pending_choices = 1;
        let max_before = u.player_max_hp;
        u.apply_powerup(1);
        assert!(u.player_max_hp > max_before);
        assert_eq!(u.pending_choices, 0);
        u.apply_powerup(2);
        assert!(u.surge_timer > 19.0);
        u.apply_powerup(3);
        assert!(u.freeze_timer > 11.0);
    }

    #[test]
    fn perf_mode_adjusts_caps() {
        let mut u = Universe::new(480.0, 800.0);
        u.set_perf_mode(0);
        assert_eq!(u.enemy_cap, MAX_ENEMIES_LOW);
        u.set_perf_mode(2);
        assert_eq!(u.enemy_cap, MAX_ENEMIES);
        assert!(u.speed_scale > 1.0);
    }

    #[test]
    fn telegraphs_precede_spawns() {
        let mut u = Universe::new(480.0, 800.0);
        // Run until first telegraph appears (interval 45 frames in wave 1).
        for _ in 0..50 {
            u.tick(0.05);
            if !u.telegraphs.is_empty() {
                break;
            }
        }
        assert!(!u.telegraphs.is_empty());
        assert!(u.enemies.is_empty());
        // Let telegraph mature -> enemy materializes.
        for _ in 0..30 {
            u.tick(0.05);
        }
        assert!(!u.enemies.is_empty());
    }

    #[test]
    fn spawn_warnings_clear_the_hud() {
        let mut u = Universe::new(480.0, 800.0);
        for _ in 0..400 {
            u.tick(0.05);
            for t in u.telegraphs.iter() {
                assert!(t.y >= HUD_CLEAR_Y, "telegraph at y={} hides under HUD", t.y);
            }
        }
        assert!(!u.enemies.is_empty()); // spawns happened on several edges
    }

    #[test]
    fn wave_progression_and_victory() {
        assert_eq!(wave_for_time(0.0), 1);
        assert_eq!(wave_for_time(61.0), 2);
        assert_eq!(wave_for_time(200.0), 4);
        assert_eq!(wave_for_time(299.0), 5);
        let mut u = Universe::new(480.0, 800.0);
        u.run_time = 299.9;
        u.tick(0.05);
        assert_eq!(u.wave, 5);
        u.run_time = 300.0;
        u.tick(0.05);
        assert!(u.is_victory());
    }

    #[test]
    fn blitz_mode_scales_waves_and_clock() {
        let mut u = Universe::new(480.0, 800.0);
        u.set_run_mode(0);
        u.run_time = 37.0;
        u.tick(0.05);
        assert_eq!(u.wave, 2);
        u.run_time = 180.0;
        u.tick(0.05);
        assert!(u.is_victory());
    }

    #[test]
    fn endless_never_wins_and_overtime_bites() {
        let mut u = Universe::new(480.0, 800.0);
        u.set_run_mode(2);
        u.run_time = 400.0;
        u.tick(0.05);
        assert!(!u.is_victory());
        assert_eq!(u.wave, 5);
        assert!(u.overtime_mins() > 1.6);
    }

    #[test]
    fn loadout_applies_once_before_start() {
        let mut u = Universe::new(480.0, 800.0);
        u.apply_loadout(1);
        assert_eq!(u.gauge, 50.0);
        let max_before = u.player_max_hp;
        u.apply_loadout(2);
        assert!(u.player_max_hp > max_before);
        u.apply_loadout(3);
        assert!(u.surge_timer > 9.0);
        // Locked once the clock runs.
        u.run_time = 1.0;
        u.gauge = 0.0;
        u.apply_loadout(1);
        assert_eq!(u.gauge, 0.0);
    }

    #[test]
    fn merge_count_tracked() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = u.orbs[0].y + 1.0;
        u.tick(0.016);
        assert_eq!(u.get_merge_count(), 1);
        assert_eq!(u.last_merge_tier, 2);
    }

    #[test]
    fn merge_fires_beam_toward_player() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = u.orbs[0].y + 1.0;
        u.tick(0.016);
        assert_eq!(u.beams.len(), 1);
        let b = &u.beams[0];
        assert!((b.x2 - u.player_x).abs() < 0.01);
        // Beam fades.
        for _ in 0..10 {
            u.tick(0.05);
        }
        assert!(u.beams.is_empty());
    }

    #[test]
    fn beam_damages_enemies_in_path() {
        let mut u = Universe::new(480.0, 800.0);
        // Beam runs from merge (100,~41) toward player (240,680).
        // At y=400 the beam x ≈ 179 — park the enemy on the line,
        // outside radial reach (dist to merge ≈ 367 > 120).
        u.enemies.push(Enemy {
            id: 1,
            x: 179.0,
            y: 400.0,
            vx: 0.0,
            vy: 0.0,
            hp: 1000.0,
            max_hp: 1000.0,
            radius: 10.0,
            speed: 0.0,
            kind: 0,
            frozen_until: 0.0,
        });
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = u.orbs[0].y + 1.0;
        u.tick(0.016);
        assert!(u.enemies[0].hp < 1000.0);
    }

    #[test]
    fn pity_engine_guarantees_rail() {
        let mut p = MercyPityEngine::new(3, 0.0);
        assert!(!p.evaluate_drop(0.99));
        assert!(!p.evaluate_drop(0.99));
        assert!(p.evaluate_drop(0.99)); // hard pity fires
        assert_eq!(p.consecutive_failures, 0);
    }

    #[test]
    fn kills_drop_energy_and_player_harvests() {
        let mut u = Universe::new(480.0, 800.0);
        // Six guaranteed kills: pity rail (threshold 5) forces >= 1 cell.
        for k in 0..6 {
            u.enemies.push(Enemy {
                id: 100 + k,
                x: 100.0,
                y: 100.0,
                vx: 0.0,
                vy: 0.0,
                hp: 1.0,
                max_hp: 100.0,
                radius: 10.0,
                speed: 0.0,
                kind: 0,
                frozen_until: 0.0,
            });
        }
        // L2 merge at the kill site: radial blast clears them.
        u.drop_orb(100.0, 2);
        u.drop_orb(100.0, 2);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = 100.0;
        u.orbs[0].y = 100.0;
        u.tick(0.016);
        assert!(u.enemies.is_empty());
        assert!(!u.energies.is_empty());
        // Harvest: move a cell onto the player.
        u.energies[0].x = u.player_x;
        u.energies[0].y = u.player_y;
        u.tick(0.016);
        assert!(u.gauge > 0.0);
    }

    #[test]
    fn charged_drop_spends_full_gauge() {
        let mut u = Universe::new(480.0, 800.0);
        assert!(!u.drop_charged(100.0));
        u.gauge = 100.0;
        assert!(u.drop_charged(100.0));
        assert_eq!(u.gauge, 0.0);
        assert_eq!(u.orbs.len(), 1);
        assert_eq!(u.orbs[0].level, 4);
    }

    #[test]
    fn cryo_freeze_expires_without_changing_base_speed() {
        let mut u = Universe::new(480.0, 800.0);
        u.enemies.push(Enemy {
            id: 1, x: 240.0, y: 200.0, vx: 0.0, vy: 0.0,
            hp: 1000.0, max_hp: 1000.0, radius: 10.0, speed: 50.0,
            kind: 0, frozen_until: 2.0,
        });
        u.tick(0.1);
        assert_eq!(u.enemies[0].y, 200.0);
        assert_eq!(u.enemies[0].speed, 50.0);
        u.run_time = 2.0;
        u.tick(0.1);
        assert!(u.enemies[0].y > 200.0);
    }

    #[test]
    fn resize_preserves_relative_positions_and_run_progress() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(240.0, 2);
        u.run_time = 42.0;
        u.resize(320.0, 600.0);
        assert_eq!(u.player_x, 160.0);
        assert_eq!(u.player_y, 528.0);
        assert_eq!(u.orbs[0].x, 160.0);
        assert_eq!(u.orbs[0].y, 30.0);
        assert_eq!(u.run_time, 42.0);
    }
    #[test]
    fn movement_is_independent_of_pointer_event_frequency() {
        let mut once = Universe::new(480.0, 800.0);
        let mut repeated = Universe::new(480.0, 800.0);
        once.move_player(440.0);
        for _ in 0..100 { repeated.move_player(440.0); }
        assert_eq!(once.player_x, 240.0);
        for _ in 0..12 {
            once.tick(1.0 / 60.0);
            repeated.move_player(440.0);
            repeated.tick(1.0 / 60.0);
        }
        assert!((once.player_x - repeated.player_x).abs() < 0.001);
        assert!(once.player_x > 300.0 && once.player_x < 440.0);
    }
    #[test]
    fn cell_collision_exchanges_velocity_and_separates() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(200.0, 1); u.drop_orb(230.0, 2);
        u.orbs[0].y = 300.0; u.orbs[1].y = 300.0;
        u.orbs[0].vx = 100.0; u.orbs[1].vx = -100.0;
        u.step_cells(1.0 / 60.0);
        assert!(u.orbs[0].vx < 100.0);
        assert!(u.orbs[1].vx > -100.0);
        assert!(u.orbs[1].x - u.orbs[0].x >= u.orbs[0].radius + u.orbs[1].radius - 0.2);
    }
    #[test]
    fn floor_friction_settles_a_cell() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(240.0, 1);
        u.orbs[0].y = 700.0 - u.orbs[0].radius; u.orbs[0].vx = 100.0;
        for _ in 0..180 { u.step_cells(1.0 / 60.0); }
        assert!(u.orbs[0].vx.abs() < 1.0);
        assert!(u.orbs[0].vy.abs() < 1.0);
        assert!(u.orbs[0].y + u.orbs[0].radius <= 700.01);
    }
    #[test]
    fn fast_horizontal_cell_does_not_tunnel_through_a_match() {
        let mut u = Universe::new(480.0, 800.0);
        u.drop_orb(60.0, 1); u.drop_orb(150.0, 1);
        u.orbs[0].y = 300.0; u.orbs[1].y = 300.0; u.orbs[0].vx = 4000.0;
        u.tick(0.05);
        assert_eq!(u.merge_count, 1);
    }

    #[test]
    fn relay_costs_gauge_and_respects_the_cap() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 100.0;
        assert!(u.deploy_relay(100.0));
        assert!((u.gauge - 40.0).abs() < 0.01);
        assert_eq!(u.get_relay_count(), 1);
        u.gauge = 100.0;
        assert!(u.deploy_relay(200.0));
        // Third is refused: the cap holds even with gauge to spare.
        u.gauge = 100.0;
        assert!(!u.deploy_relay(300.0));
        assert_eq!(u.get_relay_count(), 2);
        // Broke: no relay.
        u.relays.clear();
        u.gauge = 0.0;
        assert!(!u.deploy_relay(100.0));
        assert_eq!(u.get_relay_count(), 0);
    }

    #[test]
    fn relay_sits_on_the_cell_deck() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 60.0;
        assert!(u.deploy_relay(240.0));
        assert_eq!(u.relays[0].x, 240.0);
        assert_eq!(u.relays[0].y, 800.0 - 100.0 - RELAY_RADIUS);
    }

    #[test]
    fn relay_fires_on_the_nearest_enemy_in_range() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 60.0;
        assert!(u.deploy_relay(240.0));
        // Two targets: the near one (240,550, dist 138) must take the shot,
        // not the far one (400,600, dist ~183, clear of the beam lane).
        for (id, x, y) in [(1u64, 240.0, 550.0), (2, 400.0, 600.0)] {
            u.enemies.push(Enemy {
                id, x, y, vx: 0.0, vy: 0.0,
                hp: 1000.0, max_hp: 1000.0, radius: 10.0, speed: 0.0,
                kind: 0, frozen_until: 0.0,
            });
        }
        for _ in 0..15 { u.tick(0.05); } // clear the 0.5s arm delay
        assert!(u.enemies[0].hp < 1000.0);
        assert_eq!(u.enemies[1].hp, 1000.0);
        // Out of range: nothing to shoot, so it stays ready and tries again.
        u.relays[0].cooldown = 0.0;
        u.enemies[0].x = 2000.0;
        u.enemies[1].x = 2000.0;
        let hp_before = u.enemies[0].hp;
        u.tick(0.05);
        assert!(u.relays[0].cooldown <= 0.0);
        assert_eq!(u.enemies[0].hp, hp_before);
    }

    #[test]
    fn daily_seed_pins_spawn_pattern() {
        let mut a = Universe::new(480.0, 800.0);
        let mut b = Universe::new(480.0, 800.0);
        a.set_seed(12345);
        b.set_seed(12345);
        for salt in [7u64, 29, 101] {
            assert_eq!(a.rand01(salt), b.rand01(salt));
        }
        let mut c = Universe::new(480.0, 800.0);
        c.set_seed(99999);
        assert_ne!(a.rand01(7), c.rand01(7));
        // Unseeded runs keep the legacy variety (seed 0 changes nothing).
        let mut d = Universe::new(480.0, 800.0);
        assert_ne!(a.rand01(7), d.rand01(7));
    }

    #[test]
    fn level_up_hardens_battery_and_sharpens_damage() {
        let mut u = Universe::new(480.0, 800.0);
        assert!((u.maturity_mult() - 1.0).abs() < 0.001);
        let max_before = u.player_max_hp;
        u.xp = u.next_xp - 1; // one merge away from level 2
        u.drop_orb(100.0, 1);
        u.drop_orb(100.0, 1);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = u.orbs[0].y + 1.0;
        u.tick(0.016);
        assert_eq!(u.level, 2);
        assert_eq!(u.player_max_hp, max_before + LEVEL_HP_GAIN);
        assert!((u.maturity_mult() - 1.03).abs() < 0.001);
        u.level = 11;
        assert!((u.maturity_mult() - 1.3).abs() < 0.001);
    }

    #[test]
    fn thief_materializes_fast_and_fragile() {
        let mut u = Universe::new(480.0, 800.0);
        u.telegraphs.push(Telegraph { x: 240.0, y: 100.0, kind: 5, timer: 0.0 });
        for _ in 0..5 { u.tick(0.05); }
        assert_eq!(u.enemies.len(), 1);
        let t = &u.enemies[0];
        assert_eq!(t.kind, 5);
        assert_eq!(t.radius, 8.0);
        // Level 1 base: hp (12+3)*0.5, speed (48+2.5)*1.9.
        assert!((t.hp - 7.5).abs() < 0.01);
        assert!((t.speed - 95.95).abs() < 0.1);
    }

    #[test]
    fn thief_siphons_gauge_on_contact_and_floors_at_zero() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 50.0;
        u.enemies.push(Enemy {
            id: 1, x: u.player_x, y: u.player_y, vx: 0.0, vy: 0.0,
            hp: 1000.0, max_hp: 1000.0, radius: 8.0, speed: 0.0,
            kind: 5, frozen_until: 0.0,
        });
        for _ in 0..20 { u.tick(0.05); } // 1s at 8 dps
        assert!((u.gauge - 42.0).abs() < 0.5);
        assert!(u.player_hp > 0.0); // siphon hurts charge; contact DPS unchanged
        // Nearly broke: drains to zero, never negative.
        u.gauge = 5.0;
        for _ in 0..20 { u.tick(0.05); }
        assert_eq!(u.gauge, 0.0);
    }

    #[test]
    fn thief_spawn_gated_by_wave_and_capped_at_two() {
        let mut u = Universe::new(480.0, 800.0);
        u.frame_count = 1;
        u.wave = 1;
        assert_eq!(u.roll_spawn_kind(0.99, 18), 0);
        u.wave = 2;
        assert_eq!(u.roll_spawn_kind(0.99, 18), 1);
        u.wave = 3;
        assert_eq!(u.roll_spawn_kind(0.95, 18), 5);
        u.wave = 4;
        assert_eq!(u.roll_spawn_kind(0.95, 18), 5);
        u.wave = 5;
        // Wave 5 opens with the boss; past the entrance the thief mix applies.
        u.boss_spawned = true;
        assert_eq!(u.roll_spawn_kind(0.92, 18), 5);
        assert_eq!(u.roll_spawn_kind(0.97, 18), 4); // overlord keeps its 5%
        // Cap: two thieves live → downgrade to grunt.
        u.wave = 3;
        for k in 0..2 {
            u.enemies.push(Enemy {
                id: 10 + k, x: 100.0, y: 100.0, vx: 0.0, vy: 0.0,
                hp: 10.0, max_hp: 10.0, radius: 8.0, speed: 0.0,
                kind: 5, frozen_until: 0.0,
            });
        }
        assert_eq!(u.roll_spawn_kind(0.95, 18), 0);
        // Incoming telegraphs count toward the cap too.
        u.enemies.pop();
        u.telegraphs.push(Telegraph { x: 1.0, y: 1.0, kind: 5, timer: 1.0 });
        assert_eq!(u.roll_spawn_kind(0.95, 18), 0);
    }

    #[test]
    fn relay_grinds_down_under_enemy_contact() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 60.0;
        assert!(u.deploy_relay(240.0));
        let ry = u.relays[0].y;
        u.enemies.push(Enemy {
            id: 9, x: 240.0, y: ry, vx: 0.0, vy: 0.0,
            hp: 1000.0, max_hp: 1000.0, radius: 10.0, speed: 0.0,
            kind: 0, frozen_until: 0.0,
        });
        // Lone contact at 10 dps vs 100 HP: alive at 3s, gone by 11s.
        for _ in 0..60 { u.tick(0.05); }
        assert_eq!(u.get_relay_count(), 1);
        for _ in 0..145 { u.tick(0.05); }
        assert_eq!(u.get_relay_count(), 0);
        // The loss reads on the field: death sparks are fresh at ~10.25s.
        assert!(!u.particles.is_empty());
    }

    #[test]
    fn relay_pile_on_damage_is_capped() {
        let mut u = Universe::new(480.0, 800.0);
        u.gauge = 60.0;
        assert!(u.deploy_relay(240.0));
        let ry = u.relays[0].y;
        for k in 0..5 {
            u.enemies.push(Enemy {
                id: 20 + k, x: 240.0, y: ry, vx: 0.0, vy: 0.0,
                hp: 10000.0, max_hp: 10000.0, radius: 10.0, speed: 0.0,
                kind: 0, frozen_until: 0.0,
            });
        }
        // Uncapped, 5 x 10 dps would kill 100 HP in 2s. Capped at 20 dps
        // the relay must still stand at 3s.
        for _ in 0..60 { u.tick(0.05); }
        assert_eq!(u.get_relay_count(), 1);
    }

    #[test]
    fn boss_opens_wave_five_exactly_once() {
        let mut u = Universe::new(480.0, 800.0);
        u.frame_count = 1;
        u.wave = 4;
        assert_ne!(u.roll_spawn_kind(0.5, 18), 6); // never before wave 5
        u.wave = 5;
        assert_eq!(u.roll_spawn_kind(0.5, 18), 6);
        // Simulate the push site: flag set, telegraph incoming.
        u.boss_spawned = true;
        u.telegraphs.push(Telegraph { x: 240.0, y: 10.0, kind: 6, timer: BOSS_TELEGRAPH_TIME });
        assert_ne!(u.roll_spawn_kind(0.5, 18), 6); // repeats downgrade
        assert_eq!(u.roll_spawn_kind(0.97, 18), 4);
    }

    #[test]
    fn boss_materializes_slow_and_huge() {
        let mut u = Universe::new(480.0, 800.0);
        u.telegraphs.push(Telegraph { x: 240.0, y: 100.0, kind: 6, timer: 0.0 });
        for _ in 0..5 { u.tick(0.05); }
        assert_eq!(u.enemies.len(), 1);
        let b = &u.enemies[0];
        assert_eq!(b.kind, 6);
        assert_eq!(b.radius, 34.0);
        // Level 1 base: hp (12+3)*40, speed (48+2.5)*0.35.
        assert!((b.hp - 600.0).abs() < 0.01);
        assert!((b.speed - 17.675).abs() < 0.1);
    }

    #[test]
    fn boss_contact_hits_harder_than_grunt() {
        let mut grunt_world = Universe::new(480.0, 800.0);
        grunt_world.enemies.push(Enemy {
            id: 1, x: grunt_world.player_x, y: grunt_world.player_y,
            vx: 0.0, vy: 0.0, hp: 10000.0, max_hp: 10000.0,
            radius: 10.0, speed: 0.0, kind: 0, frozen_until: 0.0,
        });
        let mut boss_world = Universe::new(480.0, 800.0);
        boss_world.enemies.push(Enemy {
            id: 1, x: boss_world.player_x, y: boss_world.player_y,
            vx: 0.0, vy: 0.0, hp: 10000.0, max_hp: 10000.0,
            radius: 34.0, speed: 0.0, kind: 6, frozen_until: 0.0,
        });
        for _ in 0..20 { grunt_world.tick(0.05); boss_world.tick(0.05); }
        // 1s: boss deals ~10 extra damage on top of capped contact DPS.
        let extra = grunt_world.player_hp - boss_world.player_hp;
        assert!(extra > 8.0 && extra < 12.0);
    }

    #[test]
    fn boss_death_bursts_harvestable_charge() {
        let mut u = Universe::new(480.0, 800.0);
        u.enemies.push(Enemy {
            id: 1, x: 240.0, y: 400.0, vx: 0.0, vy: 0.0,
            hp: 1.0, max_hp: 600.0, radius: 34.0, speed: 0.0,
            kind: 6, frozen_until: 0.0,
        });
        // L2 merge at the kill site clears it.
        u.drop_orb(240.0, 2);
        u.drop_orb(240.0, 2);
        u.orbs[1].x = u.orbs[0].x + 1.0;
        u.orbs[1].y = 400.0;
        u.orbs[0].y = 400.0;
        u.tick(0.016);
        assert!(u.enemies.is_empty());
        assert!(u.energies.len() >= BOSS_ENERGY_BURST);
        assert!(!u.particles.is_empty());
    }

    #[test]
    fn grid_stress_tracks_pile_and_releases() {
        let mut u = Universe::new(480.0, 800.0);
        assert_eq!(u.stress, 0.0);
        // Six cells pinned high (spaced to never merge).
        for k in 0..6 {
            u.drop_orb(60.0 + k as f32 * 60.0, 1);
        }
        for t in 0..30 {
            if t % 5 == 0 {
                for o in u.orbs.iter_mut() { o.y = 150.0; o.vx = 0.0; o.vy = 0.0; }
            }
            u.tick(0.05);
        }
        assert!(u.stress > 0.8, "piled grid must stress, got {}", u.stress);
        // Cleared board releases back toward zero.
        u.orbs.clear();
        for _ in 0..60 { u.tick(0.05); }
        assert!(u.stress < 0.2, "cleared grid must release, got {}", u.stress);
    }

    #[test]
    fn merge_shockwave_sets_up_chain_reaction() {
        let mut u = Universe::new(480.0, 800.0);
        // Pair A merges on contact; pair B (same tier) waits in pull range.
        for _ in 0..4 { u.drop_orb(100.0, 1); }
        let spots = [(100.0, 400.0), (101.0, 400.0), (175.0, 400.0), (235.0, 400.0)];
        for (o, (x, y)) in u.orbs.iter_mut().zip(spots) {
            o.x = x; o.y = y; o.vx = 0.0; o.vy = 0.0;
        }
        for _ in 0..120 { u.tick(0.05); }
        assert!(u.merge_count >= 2, "shockwave must chain pair B, got {}", u.merge_count);
    }

}
