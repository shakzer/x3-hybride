'use strict';
/**
 * free_rect.js - the biggest empty rectangle in an area, for the one thing a layout leaves room for: Cluster Info's
 * panel on the HUD (hud.js publishes it, cluster_info.js writes it, Cluster Info reads it).
 *
 *   freeRect(occupied, area, opts)   occupied: [{ x, y, w, h }] what is drawn (and what BMW draws); area: { x, y, w, h }
 *   opts: step (4 px grid), gap (6 px kept clear round everything), minW / minH (the smallest room that is any use),
 *         capW / capH (past these a rectangle is no better: the panel is never bigger)
 *   returns { x, y, w, h } or null when there is no room.
 *
 * The area is cut into step-px cells, a cell is taken when something (grown by gap) touches it, and the maximal empty
 * rectangles are found a row at a time (the histogram method: linear in the cells). They are ranked by their area
 * with each side capped, then by how low and how far right they are (where the HUD's panel sat), so two roomy places
 * tie on size and the lower right one wins. Plain Node 8.
 */
function freeRect(occupied, area, opts) {
    const o = Object.assign({ step: 4, gap: 6, minW: 120, minH: 34, capW: 330, capH: 64 }, opts);
    const s = o.step;
    const cols = Math.floor(area.w / s), rows = Math.floor(area.h / s);
    if (cols < 1 || rows < 1) return null;
    const taken = new Uint8Array(cols * rows);
    (occupied || []).forEach((r) => {
        if (!r || !isFinite(r.x) || !isFinite(r.y) || !isFinite(r.w) || !isFinite(r.h)) return;
        const x0 = Math.max(0, Math.floor((r.x - o.gap - area.x) / s)), x1 = Math.min(cols - 1, Math.ceil((r.x + r.w + o.gap - area.x) / s) - 1);
        const y0 = Math.max(0, Math.floor((r.y - o.gap - area.y) / s)), y1 = Math.min(rows - 1, Math.ceil((r.y + r.h + o.gap - area.y) / s) - 1);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) taken[y * cols + x] = 1;
    });
    let best = null, bestScore = 0;
    const heights = new Array(cols).fill(0);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) heights[x] = taken[y * cols + x] ? 0 : heights[x] + 1;
        // every maximal rectangle ending on this row: a stack of rising bars
        const stack = [];
        for (let x = 0; x <= cols; x++) {
            const h = x < cols ? heights[x] : 0;
            let start = x;
            while (stack.length && stack[stack.length - 1].h >= h) {
                const t = stack.pop();
                start = t.x;
                consider(t.x, y - t.h + 1, x - t.x, t.h);
            }
            if (h > 0 && (!stack.length || stack[stack.length - 1].h < h)) stack.push({ x: start, h });
        }
    }
    function consider(cx, cy, cw, ch) {
        const w = cw * s, h = ch * s;
        if (w < o.minW || h < o.minH) return;
        // (a rectangle's score: the room the panel could use; then low, then right)
        const score = Math.min(w, o.capW) * Math.min(h, o.capH) * 1e6 + (cy + ch) * 1e3 + cx + cw;
        if (score > bestScore) { bestScore = score; best = { x: area.x + cx * s, y: area.y + cy * s, w, h }; }
    }
    if (!best) return null;
    // the gap was only kept round what is drawn: the rectangle itself is handed back as found
    return best;
}

module.exports = { freeRect };
