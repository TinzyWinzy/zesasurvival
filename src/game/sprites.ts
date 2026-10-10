// Cyberpunk Load-Shedding sprite system: procedural Canvas 2D drawing.
// No DOM nodes, no image assets, no Macroquad — everything is canvas paths
// so hundreds of entities stay cheap. Glyph stroke counts kept tiny.

const TAU = Math.PI * 2;

// Orb tier palette: low-voltage copper→lemon, high-voltage lime→teal,
// relay supernova violets, tier-10 blinding white.
export const ORB_COLORS: Record<number, string> = {
  1: '#C87533',
  2: '#F59E0B',
  3: '#FDE047',
  4: '#A3E635',
  5: '#22D3EE',
  6: '#2DD4BF',
  7: '#7C3AED',
  8: '#9D00FF',
  9: '#D946EF',
  10: '#FFFFFF'
};

export const ENEMY_STYLE: Record<number, { color: string; radius: number }> = {
  0: { color: '#FF2A55', radius: 10 }, // grunt — crimson diamond
  1: { color: '#FFD700', radius: 8 }, // striker — gold needle triangle
  2: { color: '#9D00FF', radius: 16 }, // tank — amethyst hexagon
  3: { color: '#8B5CF6', radius: 14 }, // elite — violet pentagon
  4: { color: '#EC4899', radius: 26 }, // overlord — magenta + ring
  5: { color: '#E8A04C', radius: 8 } // cable thief — copper cutter
};

function bolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.12, cy - s * 0.5);
  ctx.lineTo(cx - s * 0.18, cy + s * 0.06);
  ctx.lineTo(cx + s * 0.06, cy + s * 0.06);
  ctx.lineTo(cx - s * 0.12, cy + s * 0.5);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tier: number,
  t: number
) {
  const c = ORB_COLORS[tier] || '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = c;
  ctx.shadowColor = c;
  ctx.shadowBlur = tier >= 7 ? 4 : 0;
  ctx.fill();
  ctx.shadowBlur = 0;

  const lw = Math.max(1.5, r * 0.14);
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (tier <= 3) {
    // Low voltage: bolt glyphs in obsidian.
    ctx.strokeStyle = 'rgba(13,13,17,0.9)';
    if (tier === 1) {
      bolt(ctx, x, y, r * 0.9);
    } else if (tier === 2) {
      bolt(ctx, x - r * 0.22, y, r * 0.62);
      bolt(ctx, x + r * 0.22, y, r * 0.62);
    } else {
      bolt(ctx, x, y, r * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.62, 0, TAU);
      ctx.stroke();
    }
  } else if (tier <= 6) {
    // High voltage: coil windings in obsidian.
    ctx.strokeStyle = 'rgba(13,13,17,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.stroke();
    const spokes = tier - 1; // 3, 4, 5
    ctx.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * TAU + t * 0.001;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    }
    ctx.stroke();
  } else if (tier <= 9) {
    // Relay supernova: pulsing ring + arc ticks in white.
    const pulse = r + 2 + Math.sin(t * 0.006 + tier) * 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.2, r * 0.09);
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, TAU);
    ctx.stroke();
    const ticks = tier - 4; // 3, 4, 5
    ctx.beginPath();
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * TAU + t * 0.002;
      ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
      ctx.lineTo(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, r * 0.16), 0, TAU);
    ctx.fill();
  } else {
    // Tier 10 Singularity: white core, event-horizon ring, orbiting sparks.
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#0D0D11';
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.74, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.004 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5), Math.max(1.2, r * 0.09), 0, TAU);
      ctx.fill();
    }
  }
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  t: number
) {
  const radius = (ENEMY_STYLE[kind] || ENEMY_STYLE[0]).radius;
  ctx.save();
  ctx.fillStyle = '#250F1C';
  ctx.strokeStyle = kind === 5 ? '#E8A04C' : kind >= 3 ? '#FDA4AF' : '#FB466A';
  ctx.lineWidth = kind === 2 ? 2.8 : 1.8;
  const sides = kind === 0 ? 4 : kind === 1 ? 3 : kind === 2 ? 6 : kind === 3 ? 5 : 8;
  poly(ctx, x, y, radius, sides, kind === 2 ? 0 : -Math.PI / 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = kind === 5 ? '#FDE68A' : '#FB466A';
  ctx.lineWidth = 1;
  poly(ctx, x, y, radius * 0.45, sides);
  ctx.stroke();
  if (kind === 5) {
    // Sparking cut across the body — the stolen wire.
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.55, y + radius * 0.55);
    ctx.lineTo(x + radius * 0.55, y - radius * 0.55);
    ctx.stroke();
  }
  if (kind === 4) {
    ctx.strokeStyle = '#FDA4AF';
    poly(ctx, x, y, radius + 7, 4, t * 0.001);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hpFrac: number,
  t: number
) {
  const health = Math.max(0, Math.min(1, hpFrac));
  ctx.save();
  ctx.strokeStyle = health < 0.3 ? '#FB7185' : '#67E8F9';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#092633';
  ctx.fillRect(x - 16, y - 20, 32, 40);
  ctx.strokeRect(x - 16, y - 20, 32, 40);
  ctx.fillStyle = '#67E8F9';
  ctx.fillRect(x - 6, y - 25, 12, 5);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = health > i / 4 ? (health < 0.3 ? '#FB7185' : '#67E8F9') : '#153647';
    ctx.fillRect(x - 11, y + 10 - i * 8, 22, 5);
  }
  ctx.strokeStyle = `rgba(103,232,249,${0.12 + health * 0.18})`;
  ctx.beginPath(); ctx.arc(x, y, 28 + Math.sin(t * 0.002), 0, TAU); ctx.stroke();
  ctx.restore();
}

export function drawBeam(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, life = 1) {
  ctx.save(); ctx.globalAlpha = Math.max(0, life);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
  ctx.strokeStyle = 'rgba(250,204,21,0.22)'; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = '#FDE68A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#FFFBE8'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
}

export function drawMergePulse(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number, combo: number, fraction: number, reduced: boolean) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - fraction);
  ctx.strokeStyle = ORB_COLORS[tier] || '#FDE68A';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, reduced ? 28 : 18 + fraction * 65, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#FFFBEB'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(combo > 1 ? `MERGE ×${Math.min(combo,8)}` : `L${tier} MERGE`, x, y - 28 - (reduced ? 0 : fraction * 28));
  ctx.restore();
}

export function drawArena(ctx: CanvasRenderingContext2D, width: number, height: number, dawn: number) {
  const floor = height - 100;
  ctx.save();
  // Distant utility infrastructure remains below the active drop lanes.
  ctx.strokeStyle = 'rgba(148,163,184,0.13)'; ctx.lineWidth = 1;
  for (const x of [22, width - 22]) {
    ctx.beginPath(); ctx.moveTo(x, floor - 130); ctx.lineTo(x - 15, floor); ctx.moveTo(x, floor - 130); ctx.lineTo(x + 15, floor);
    for (let i = 1; i < 5; i++) { const y = floor - 130 + i * 24; ctx.moveTo(x - i * 3, y); ctx.lineTo(x + i * 3, y); }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(22, floor - 110); ctx.quadraticCurveTo(width / 2, floor - 78, width - 22, floor - 110); ctx.stroke();
  ctx.fillStyle = 'rgba(251,191,36,0.12)';
  for (let i = 0; i < 8; i++) {
    const x = i * width / 8;
    const roof = floor - 20 - (i % 3) * 8;
    ctx.fillStyle = 'rgba(8,17,32,0.45)'; ctx.fillRect(x, roof, width / 8 - 3, floor - roof);
    ctx.fillStyle = `rgba(253,230,138,${0.08 + dawn * 0.3})`; ctx.fillRect(x + 8, roof + 8, 3, 4);
  }
  ctx.fillStyle = 'rgba(2,6,23,0.85)'; ctx.fillRect(0, floor, width, 100);
  ctx.strokeStyle = '#38566A'; ctx.beginPath(); ctx.moveTo(0, floor); ctx.lineTo(width, floor); ctx.stroke();
  ctx.strokeStyle = 'rgba(103,232,249,0.18)'; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(0, height - 72); ctx.lineTo(width, height - 72); ctx.stroke();
  ctx.setLineDash([]); ctx.font = '9px system-ui'; ctx.fillStyle = '#64748B'; ctx.textAlign = 'left'; ctx.fillText('CELL DECK', 10, floor + 13);
  ctx.restore();
}

export function drawTelegraph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frac: number,
  t: number
) {
  const pulse = 6 + frac * 10 + Math.sin(t * 0.012) * 2;
  ctx.strokeStyle = `rgba(255,42,85,${0.4 + frac * 0.6})`;
  ctx.lineWidth = 2 + frac * 2;
  ctx.beginPath();
  ctx.arc(x, y, pulse, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 6, 0, TAU);
  ctx.stroke();
  // Hazard ticks.
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + Math.PI / 4;
    ctx.moveTo(x + Math.cos(a) * (pulse + 2), y + Math.sin(a) * (pulse + 2));
    ctx.lineTo(x + Math.cos(a) * (pulse + 8), y + Math.sin(a) * (pulse + 8));
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(255,42,85,${0.5 + frac * 0.5})`;
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', x, y);
}

export function drawEnergy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seed: number,
  t: number
) {
  const bob = Math.sin(t * 0.004 + seed) * 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 7 + bob);
  ctx.lineTo(x + 6, y + bob);
  ctx.lineTo(x, y + 7 + bob);
  ctx.lineTo(x - 6, y + bob);
  ctx.closePath();
  ctx.fillStyle = '#4ADE80';
  ctx.shadowColor = '#4ADE80';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** Cheap inter-orb arc tick: single jittered segment, no shadow. */
export function drawArcTick(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 10;
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 10;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(mx, my);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(217,70,239,0.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Friendly relay: a cyan substation pylon on the cell deck. The ring shows
 * range, the arc fills as it readies its next shot, and damage dims the core.
 */
export function drawRelay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hpFrac: number,
  cooldownFrac: number,
  t: number
) {
  const hp = Math.max(0, Math.min(1, hpFrac));
  const ready = Math.max(0, Math.min(1, cooldownFrac));
  const r = 12;
  ctx.save();

  ctx.strokeStyle = `rgba(34,211,238,${0.1 + 0.07 * Math.sin(t * 0.004)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 26 + Math.sin(t * 0.004) * 2, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = '#062028';
  ctx.strokeStyle = '#22D3EE';
  ctx.lineWidth = 2;
  poly(ctx, x, y, r, 6, 0);
  ctx.fill();
  ctx.stroke();

  // Crossarm insulators.
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y - r * 0.3);
  ctx.lineTo(x + r * 0.5, y - r * 0.3);
  ctx.moveTo(x - r * 0.62, y + r * 0.2);
  ctx.lineTo(x + r * 0.62, y + r * 0.2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34,211,238,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + ready * TAU);
  ctx.stroke();

  if (hp < 1) {
    ctx.fillStyle = `rgba(2,6,23,${0.55 * (1 - hp)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
