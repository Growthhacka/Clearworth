/* Dependency-free SVG/HTML charts. Colours come from CSS variables so light/dark are selected, not inverted.
 * Rules followed: fixed categorical order, 2px lines, 2px surface gaps/rings, hairline recessive grid,
 * legend for 2+ series, hover tooltips, and a table view for every chart card. */
(function () {
  'use strict';
  const { html, raw, esc, icon } = window.CW;
  const Charts = (window.Charts = {});
  const reg = {};
  let uid = 0;

  const color = (i) => (i >= 7 ? 'var(--s-other)' : `var(--s${i + 1})`);
  Charts.color = color;

  // ---------- nice axis ticks ----------
  function niceTicks(min, max, count = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  // ---------- donut ----------
  Charts.donut = (items, { center, fmt } = {}) => {
    const list = items.filter((i) => i.value > 0);
    if (!list.length) return html`<p class="muted">Nothing to show yet.</p>`;
    let data = list.slice(0, 7);
    if (list.length > 7) data.push({ label: 'Other', value: list.slice(7).reduce((a, b) => a + b.value, 0), other: true });
    const total = data.reduce((a, b) => a + b.value, 0);
    const R = 70, C = 2 * Math.PI * R, GAP = data.length > 1 ? 2.5 : 0;
    let offset = 0;
    const segs = data.map((d, i) => {
      const len = (d.value / total) * C;
      const s = html`<circle cx="90" cy="90" r="${R}" fill="none" stroke="${d.other ? 'var(--s-other)' : color(i)}" stroke-width="20" stroke-dasharray="${Math.max(len - GAP, 0.5)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)" data-tip="${d.label}\n${fmt(d.value)} · ${((d.value / total) * 100).toFixed(1)}%"/>`;
      offset += len;
      return s;
    });
    const legend = data.map((d, i) => html`<div class="lg"><span><i style="background:${d.other ? 'var(--s-other)' : color(i)}"></i><span class="ellipsis">${d.label}</span></span><span class="v num">${((d.value / total) * 100).toFixed(0)}%</span></div>`);
    return html`<div class="donut-wrap"><div class="chart"><svg viewBox="0 0 180 180" role="img" aria-label="Breakdown chart"><circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="20"/>${segs}${center ? html`<text x="90" y="88" text-anchor="middle" style="font-size:17px;font-weight:700;fill:var(--ink)">${center.value}</text><text x="90" y="106" text-anchor="middle" style="font-size:11px">${center.label}</text>` : ''}</svg></div><div class="legend">${legend}</div></div>`;
  };

  // ---------- horizontal bars ----------
  Charts.hbars = (items, { fmt, max } = {}) => {
    const list = items.filter((i) => i.value > 0);
    if (!list.length) return html`<p class="muted">Nothing to show yet.</p>`;
    const top = max || Math.max(...list.map((i) => i.value));
    return html`<div class="hbars">${list.map((d, i) => html`<div class="hbar" data-tip="${d.label}\n${fmt(d.value)}"><div class="top"><span class="ellipsis">${d.label}</span><b class="num">${fmt(d.value)}</b></div><div class="track"><i style="width:${Math.max(1, (d.value / top) * 100).toFixed(2)}%;background:${d.color || color(i)}"></i></div></div>`)}</div>`;
  };

  // ---------- stacked bar (composition) ----------
  Charts.stack = (items, { fmt }) => {
    const list = items.filter((i) => i.value > 0);
    const total = list.reduce((a, b) => a + b.value, 0);
    if (!total) return '';
    return html`<div class="stackbar" role="img" aria-label="Composition">${list.map((d) => html`<i style="width:${((d.value / total) * 100).toFixed(2)}%;background:${d.color}" data-tip="${d.label}\n${fmt(d.value)} · ${((d.value / total) * 100).toFixed(1)}%"></i>`)}</div>`;
  };

  // ---------- line / area chart ----------
  // series: [{ name, color, points: [{ x:number, y:number }] }]   opts: { xLabel(x), xTick(x), yFmt(y), tipTitle(x), height, area }
  Charts.line = (series, opts = {}) => {
    const ss = series.filter((s) => s.points && s.points.length);
    if (!ss.length) return html`<p class="muted">No history yet.</p>`;
    const id = 'lc' + ++uid;
    const view = document.getElementById('view');
    let frac = opts.frac || 1;
    if (window.innerWidth < 1100) frac = 1;
    const est = view ? (view.clientWidth - 56) * frac - 40 - (frac < 1 ? 12 : 0) : 600;
    const W = opts.width || Math.round(Math.max(300, Math.min(900, est)));
    const H = opts.height || 250, L = 58, Rm = 18, T = 12, B = 28;
    const allX = ss.flatMap((s) => s.points.map((p) => p.x));
    const allY = ss.flatMap((s) => s.points.map((p) => p.y));
    let xmin = Math.min(...allX), xmax = Math.max(...allX);
    if (xmin === xmax) { xmin -= 1; xmax += 1; }
    let ymin = Math.min(...allY), ymax = Math.max(...allY);
    if (ymin > 0) ymin = 0;
    if (ymax < 0) ymax = 0;
    const ticks = niceTicks(ymin, ymax, 4);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const sx = (x) => L + ((x - xmin) / (xmax - xmin)) * (W - L - Rm);
    const sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
    const xTicks = [];
    const n = Math.min(typeof innerWidth !== 'undefined' && innerWidth < 640 ? 3 : 5, Math.max(2, new Set(allX).size)); // fewer date labels on phones so they never collide
    for (let i = 0; i < n; i++) xTicks.push(xmin + ((xmax - xmin) * i) / (n - 1));

    const grid = ticks.map((t) => html`<line x1="${L}" x2="${W - Rm}" y1="${sy(t)}" y2="${sy(t)}" stroke="${t === 0 ? 'var(--line)' : 'var(--grid)'}"/><text x="${L - 8}" y="${sy(t) + 4}" text-anchor="end">${opts.yFmt ? opts.yFmt(t) : t}</text>`);
    const xl = xTicks.map((x, i) => html`<text x="${sx(x)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${opts.xTick ? opts.xTick(x) : x}</text>`);
    const lines = ss.map((s) => {
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');
      const last = s.points[s.points.length - 1];
      const area = opts.area !== false && ss.length === 1 ? html`<path d="${d}L${sx(last.x).toFixed(1)} ${sy(0 > y0 ? 0 : y0)}L${sx(s.points[0].x).toFixed(1)} ${sy(0 > y0 ? 0 : y0)}Z" fill="${s.color}" fill-opacity=".10"/>` : '';
      return html`${area}<path class="ln" d="${d}" stroke="${s.color}"/><circle cx="${sx(last.x)}" cy="${sy(last.y)}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    });
    const hoverDots = ss.map((s) => html`<circle class="hd" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2" style="display:none"/>`);
    const legend = ss.length > 1 ? html`<div class="legend">${ss.map((s) => html`<span><i style="background:${s.color}"></i>${s.name}</span>`)}</div>` : '';
    reg[id] = { ss, W, H, L, Rm, T, B, sx, sy, xmin, xmax, opts };
    return html`<div class="chart lc" data-id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label || 'Line chart'}"><g class="grid">${grid}</g>${xl}${lines}<line class="xh" y1="${T}" y2="${H - B}" stroke="var(--line)" stroke-width="1" style="display:none"/>${hoverDots}<rect class="hit" x="${L}" y="${T}" width="${W - L - Rm}" height="${H - T - B}"/></svg>${legend}</div>`;
  };

  // ---------- tooltip + mount ----------
  let tip;
  const tipEl = () => tip || (tip = Object.assign(document.body.appendChild(document.createElement('div')), { className: 'tip hidden' }));
  function showTip(x, y, innerHtml) {
    const t = tipEl();
    t.innerHTML = innerHtml;
    t.classList.remove('hidden');
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > innerHeight - 8) top = y - r.height - 14;
    t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, top) + 'px';
  }
  const hideTip = () => tipEl().classList.add('hidden');
  const tipHtml = (s) => { const [a, ...rest] = String(s).split('\n'); return `<b>${esc(a)}</b>${rest.map((r) => '<br>' + esc(r)).join('')}`; };

  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el) showTip(e.clientX, e.clientY, tipHtml(el.getAttribute('data-tip')));
  });
  document.addEventListener('mouseover', (e) => { if (!(e.target.closest && e.target.closest('[data-tip], .lc .hit'))) hideTip(); });
  document.addEventListener('scroll', hideTip, true);

  function bindLine(box) {
    const spec = reg[box.dataset.id];
    if (!spec || box.dataset.bound) return;
    box.dataset.bound = '1';
    const svg = box.querySelector('svg');
    const hit = box.querySelector('.hit');
    const xh = box.querySelector('.xh');
    const dots = [...box.querySelectorAll('.hd')];
    const xs = [...new Set(spec.ss.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const vx = ((e.clientX - r.left) / r.width) * spec.W;
      const dataX = spec.xmin + ((vx - spec.L) / (spec.W - spec.L - spec.Rm)) * (spec.xmax - spec.xmin);
      let best = xs[0];
      for (const x of xs) if (Math.abs(x - dataX) < Math.abs(best - dataX)) best = x;
      xh.setAttribute('x1', spec.sx(best)); xh.setAttribute('x2', spec.sx(best)); xh.style.display = '';
      const rows = [];
      spec.ss.forEach((s, i) => {
        const p = s.points.find((q) => q.x === best);
        if (p) {
          dots[i].setAttribute('cx', spec.sx(best)); dots[i].setAttribute('cy', spec.sy(p.y)); dots[i].style.display = '';
          rows.push(`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:6px"></span>${esc(s.name)}: <b>${esc(spec.opts.tipFmt ? spec.opts.tipFmt(p.y) : p.y)}</b>`);
        } else dots[i].style.display = 'none';
      });
      showTip(e.clientX, e.clientY, `<b>${esc(spec.opts.tipTitle ? spec.opts.tipTitle(best) : best)}</b><br>${rows.join('<br>')}`);
    };
    hit.addEventListener('mousemove', move);
    hit.addEventListener('touchstart', (e) => move(e.touches[0]), { passive: true });
    hit.addEventListener('touchmove', (e) => move(e.touches[0]), { passive: true });
    hit.addEventListener('mouseleave', () => { xh.style.display = 'none'; dots.forEach((d) => (d.style.display = 'none')); hideTip(); });
  }

  Charts.mount = (root) => {
    root.querySelectorAll('.lc').forEach(bindLine);
    root.querySelectorAll('[data-table-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.card');
        const showTable = card.querySelector('.table-pane').classList.contains('hidden');
        card.querySelector('.table-pane').classList.toggle('hidden', !showTable);
        card.querySelector('.chart-pane').classList.toggle('hidden', showTable);
        btn.textContent = showTable ? 'View as chart' : 'View as table';
      });
    });
  };

  // Card with title, chart pane and an accessible table pane.
  Charts.card = ({ title, sub, chart, table, tools }) => html`<div class="card"><div class="card-head"><div><h3>${title}</h3>${sub ? html`<div class="sub">${sub}</div>` : ''}</div><div class="chart-tools">${tools || ''}${table ? html`<button class="toggle-table" data-table-toggle type="button">View as table</button>` : ''}</div></div><div class="chart-pane">${chart}</div>${table ? html`<div class="table-pane hidden scroll-x"><table class="tbl"><thead><tr>${table.head.map((h, i) => html`<th class="${i ? 'r' : ''}">${h}</th>`)}</tr></thead><tbody>${table.rows.map((r) => html`<tr>${r.map((c, i) => html`<td class="${i ? 'r' : ''}">${c}</td>`)}</tr>`)}</tbody></table></div>` : ''}</div>`;
})();
