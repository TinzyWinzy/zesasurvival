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
  4: { color: '#EC4899', radius: 26 } // overlord — magenta + ring
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
  ctx.shadowBlur = 10;
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
  const s = ENEMY_STYLE[kind] || ENEMY_STYLE[0];
  const r = s.radius;
  ctx.fillStyle = s.color;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = 8;
  if (kind === 0) {
    poly(ctx, x, y, r, 4, -Math.PI / 2); // diamond
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(13,13,17,0.85)';
    poly(ctx, x, y, r * 0.38, 4, -Math.PI / 2);
    ctx.fill();
  } else if (kind === 1) {
    poly(ctx, x, y, r, 3, -Math.PI / 2); // needle triangle
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (kind === 2) {
    poly(ctx, x, y, r, 6, 0); // armored hexagon
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(13,13,17,0.9)';
    ctx.lineWidth = 2;
    poly(ctx, x, y, r * 0.62, 6, 0);
    ctx.stroke();
  } else if (kind === 3) {
    poly(ctx, x, y, r, 5, -Math.PI / 2); // pentagon
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.2, 0, TAU);
    ctx.fill();
  } else {
    ctx.beginPath(); // overlord core
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, TAU);
    ctx.stroke();
    const a = t * 0.002; // rotating tick
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    ctx.lineTo(x + Math.cos(a) * (r + 11), y + Math.sin(a) * (r + 11));
    ctx.stroke();
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hpFrac: number,
  t: number
) {
  // Shield ring: opacity tracks charge.
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, TAU);
  ctx.strokeStyle = `rgba(0,240,255,${0.2 + 0.5 * Math.max(0, Math.min(1, hpFrac))})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Generator core.
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, TAU);
  ctx.fillStyle = '#00F0FF';
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#06303A';
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, TAU);
  ctx.fill();
  // Direction vector arrow (faces the swarm above).
  const bob = Math.sin(t * 0.005) * 1.5;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y - 26 + bob);
  ctx.lineTo(x - 5, y - 18 + bob);
  ctx.lineTo(x + 5, y - 18 + bob);
  ctx.closePath();
  ctx.fill();
}

/** Aimed discharge: one faint amber stroke. Damage lives in the engine;
 * the visual stays quiet so merges read clean. */
export function drawBeam(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(250,204,21,0.4)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
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
