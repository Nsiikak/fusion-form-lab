/** Share cards drawn on a canvas in the brand style, downloaded as PNG. No server needed. */
const NAVY = "#13213C", CREAM = "#FFF7EC", AMBER = "#E8770E", BURNT = "#B8520B", EMERALD = "#0E8F6A", GOLD = "#F2B33D", MUTED = "#555F73";

export type CardFormat = "square" | "story";
const SIZE: Record<CardFormat, [number, number]> = { square: [1080, 1080], story: [1080, 1920] };

async function fonts() {
  await Promise.all(["800 80px Sora", "700 40px 'Plus Jakarta Sans'", "400 40px 'Plus Jakarta Sans'"].map((f) => document.fonts.load(f).catch(() => null)));
}

function honeycomb(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2;
  const r = 52, dx = r * Math.sqrt(3), dy = r * 1.5;
  for (let row = -1; row * dy < h + r; row++) {
    for (let col = -1; col * dx < w + r; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * dy;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg: string, size = 34) {
  ctx.font = `700 ${size}px 'Plus Jakarta Sans', Arial, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.4, h = size * 1.9;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, x + size * 0.7, y + h / 2); ctx.textBaseline = "alphabetic";
  return h;
}

function logo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dark: boolean) {
  ctx.font = `800 ${size}px Sora, 'Plus Jakarta Sans', Arial, sans-serif`;
  ctx.fillStyle = dark ? CREAM : NAVY; ctx.fillText("Plago", x, y);
  ctx.fillStyle = AMBER; ctx.fillText("hive", x + ctx.measureText("Plago").width, y);
}

async function loadImage(src?: string | null): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
  });
}

function canvasFor(format: CardFormat) {
  const [w, h] = SIZE[format];
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return { c, ctx: c.getContext("2d")!, w, h };
}

export interface VendorCardInfo { businessName: string; category: string; location: string; photo?: string | null; url: string }

/** "Verified on Plagohive · Now accepting bookings" */
export async function verifiedCard(v: VendorCardInfo, format: CardFormat): Promise<HTMLCanvasElement> {
  await fonts();
  const { c, ctx, w, h } = canvasFor(format);
  const story = format === "story";
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, w, h);
  honeycomb(ctx, w, h, "rgba(243,199,143,0.45)");
  const photo = await loadImage(v.photo);
  let y = 90;
  if (photo) {
    const ph = story ? 760 : 400, pw = w - 180;
    ctx.save(); ctx.beginPath(); ctx.roundRect(90, y, pw, ph, 40); ctx.clip();
    const s = Math.max(pw / photo.width, ph / photo.height);
    ctx.drawImage(photo, 90 + (pw - photo.width * s) / 2, y + (ph - photo.height * s) / 2, photo.width * s, photo.height * s);
    ctx.restore();
    pill(ctx, 120, y + 30, "\u2713 Verified on Plagohive", EMERALD, "#fff", 30);
    y += ph + 70;
  } else {
    pill(ctx, 90, y, "\u2713 Verified on Plagohive", EMERALD, "#fff", 32);
    y += story ? 300 : 150;
  }
  ctx.fillStyle = MUTED; ctx.font = `700 34px 'Plus Jakarta Sans', Arial, sans-serif`;
  ctx.fillText(`${v.category.toUpperCase()} \u00b7 ${v.location}`.slice(0, 48), 90, y); y += 30;
  const nameSize = story ? 104 : photo ? 76 : 96;
  ctx.font = `800 ${nameSize}px Sora, 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = NAVY;
  for (const line of wrap(ctx, v.businessName, w - 180).slice(0, 3)) { y += nameSize * 1.05; ctx.fillText(line, 90, y); }
  y += story ? 110 : 80;
  ctx.font = `800 ${story ? 68 : 54}px Sora, 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = BURNT; ctx.fillText("Now accepting bookings", 90, y);
  y += story ? 70 : 56;
  ctx.font = `400 ${story ? 40 : 34}px 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = NAVY;
  for (const line of wrap(ctx, "Book me safely: your payment is held until your event is done.", w - 180)) { ctx.fillText(line, 90, y); y += story ? 54 : 46; }
  // footer
  ctx.fillStyle = NAVY; ctx.beginPath(); ctx.roundRect(90, h - 190, w - 180, 110, 55); ctx.fill();
  logo(ctx, 140, h - 118, 44, true);
  ctx.font = `700 34px 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = GOLD; ctx.textAlign = "right";
  ctx.fillText(v.url, w - 140, h - 122); ctx.textAlign = "left";
  return c;
}

export interface StatsCardInfo { businessName: string; stats: { label: string; value: string }[]; url: string }

/** "My Plagohive numbers" for socials. */
export async function statsCard(v: StatsCardInfo, format: CardFormat): Promise<HTMLCanvasElement> {
  await fonts();
  const { c, ctx, w, h } = canvasFor(format);
  const story = format === "story";
  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, w, h);
  honeycomb(ctx, w, h, "rgba(255,255,255,0.06)");
  logo(ctx, 90, 150, 52, true);
  let y = story ? 560 : 290;
  ctx.font = `800 ${story ? 104 : 72}px Sora, 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = CREAM;
  for (const line of wrap(ctx, v.businessName, w - 180).slice(0, 2)) { ctx.fillText(line, 90, y); y += story ? 100 : 80; }
  ctx.font = `700 ${story ? 40 : 36}px 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = GOLD; ctx.fillText("ON PLAGOHIVE SO FAR", 90, y); y += story ? 120 : 70;
  const cols = 2, gap = 30, cw = (w - 180 - gap) / cols, ch = story ? 400 : 210;
  v.stats.slice(0, 4).forEach((s, i) => {
    const x = 90 + (i % cols) * (cw + gap), yy = y + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.beginPath(); ctx.roundRect(x, yy, cw, ch, 32); ctx.fill();
    ctx.fillStyle = CREAM; ctx.font = `800 ${story ? 128 : 72}px Sora, 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillText(s.value, x + 40, yy + (story ? 210 : 110));
    ctx.fillStyle = "#C9CFDA"; ctx.font = `700 ${story ? 40 : 30}px 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillText(s.label, x + 40, yy + (story ? 300 : 165));
  });
  ctx.fillStyle = AMBER; ctx.beginPath(); ctx.roundRect(90, h - 190, w - 180, 110, 55); ctx.fill();
  ctx.font = `700 38px 'Plus Jakarta Sans', Arial, sans-serif`; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
  ctx.fillText(`Book me safely at ${v.url}`, w / 2, h - 122); ctx.textAlign = "left";
  return c;
}

export function download(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, "image/png");
}
