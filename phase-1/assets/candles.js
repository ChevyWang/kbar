/* candles.js — K线 SVG 渲染组件（K线训练营共享资产，v2）
 * 用法:
 *   Kbar.candle({o,h,l,c}, {w,h,ticks:'label'|'mark'|false}) -> {svg, dir, bodyRatio, closePos}
 *   Kbar.anatomy({dir:'bull'|'bear'})   -> 完整标注解剖图 SVG
 *   Kbar.row(candles, {w,h,caps,hl})    -> 多根K线序列（共享价格刻度）
 *   Kbar.chart(candles, opts)           -> 完整图表（v2）：可选量能柱、水平位、区域、结构标注、逐根揭示
 *       opts: { w, h, caps:[每根下方文字], hl:高亮第i根,
 *               vol:[成交量数组],
 *               levels:[{y,label,color,dash}],   // 水平位虚线+右标签
 *               lines:[{i1,p1,i2,p2,color,dash,label}], // 斜线（趋势线/通道线，i为0-based棒索引）
 *               zones:[{y1,y2,label,color}],     // 支撑/阻力区域底纹
 *               marks:[{i,text,pos:'above'|'below'}], // 摆动点标注（HH/HL/LH/LL）
 *               reveal:前k根,                     // 逐根揭示（刻度仍按全集固定）
 *               yLabels:布尔 }                    // 右侧价格刻度
 *   Kbar.playback(selector, candles, opts) -> 交互式逐根揭示训练器（基于 chart 的 reveal）
 * 约定: 红涨绿跌（A股惯例）。方向的双重无障碍编码，勿删：
 *   ① 阳线实体空心（描边不填充），阴线实体实心——红绿色盲与黑白打印下"空心=涨、实心=跌"仍可辨；
 *   ② 单根图开=左侧刻度、收=右侧刻度。
 */
(function () {
  'use strict';
  var UP = '#d33a2c', DOWN = '#1a7f37', INK = '#1c1c1a', MUTED = '#6e6c64', FAINT = '#a3a198';
  var SANS = '-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

  function candle(k, opts) {
    opts = opts || {};
    var w = opts.w || 130, h = opts.h || 180, ticks = opts.ticks === undefined ? 'mark' : opts.ticks;
    var pad = 22, bw = Math.round(w * 0.34);
    var o = k.o, h_ = k.h, l = k.l, c = k.c;
    var range = h_ - l;
    if (!(range > 0)) range = 1; // 一字板：给最小可视高度
    var y = function (p) { return pad + (1 - (p - l) / range) * (h - pad * 2); };

    var bull = c >= o;
    var col = bull ? UP : DOWN;
    var cx = w / 2;
    var yO = y(o), yC = y(c), yH = y(h_), yL = y(l);
    var bodyTop = Math.min(yO, yC), bodyH = Math.max(Math.abs(yC - yO), 3);

    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img">';
    s += '<line x1="' + cx + '" y1="' + yH + '" x2="' + cx + '" y2="' + bodyTop + '" stroke="' + col + '" stroke-width="2"/>';
    s += '<line x1="' + cx + '" y1="' + (bodyTop + bodyH) + '" x2="' + cx + '" y2="' + yL + '" stroke="' + col + '" stroke-width="2"/>';
    s += '<rect x="' + (cx - bw / 2) + '" y="' + bodyTop + '" width="' + bw + '" height="' + bodyH +
      '" rx="2" fill="' + (bull ? 'none' : col) + '" stroke="' + col + '" stroke-width="1.5"/>';
    if (ticks !== false) {
      var tl = bw / 2 + 4, tr = bw / 2 + 12;
      s += '<line x1="' + (cx - tr) + '" y1="' + yO + '" x2="' + (cx - tl) + '" y2="' + yO + '" stroke="' + INK + '" stroke-width="2"/>';
      s += '<line x1="' + (cx + tl) + '" y1="' + yC + '" x2="' + (cx + tr) + '" y2="' + yC + '" stroke="' + INK + '" stroke-width="2"/>';
      if (ticks === 'label') {
        s += '<text x="' + (cx - tr - 3) + '" y="' + (yO + 4) + '" text-anchor="end" font-family="' + SANS + '" font-size="12" fill="' + INK + '">开 ' + o + '</text>';
        s += '<text x="' + (cx + tr + 3) + '" y="' + (yC + 4) + '" text-anchor="start" font-family="' + SANS + '" font-size="12" fill="' + INK + '">收 ' + c + '</text>';
      }
    }
    s += '</svg>';
    return {
      svg: s,
      dir: bull ? 'bull' : 'bear',
      bodyRatio: range > 0 ? Math.abs(c - o) / range : 1,
      closePos: range > 0 ? (c - l) / range : 1
    };
  }

  /* 完整标注解剖图：影线/实体维度括注 + 价格阶梯，用于课件与术语手册 */
  function anatomy(o) {
    o = o || {};
    var bull = o.dir !== 'bear';
    var k = bull ? { o: 42, h: 96, l: 10, c: 86 } : { o: 86, h: 96, l: 10, c: 42 };
    var r = candle(k, { w: 190, h: 250, ticks: 'label' });
    var k2 = bull ? { o: 86, h: 96, l: 10, c: 42 } : { o: 42, h: 96, l: 10, c: 86 };
    // 主K线（左，带标注）+ 对照K线（右）
    var w = 470, h = 250, mainX = 120, ghostX = 330, pad = 22;
    var range = k.h - k.l;
    var y = function (p) { return pad + (1 - (p - k.l) / range) * (h - pad * 2); };
    var bw = 44;
    var yO = y(k.o), yC = y(k.c), yH = y(k.h), yL = y(k.l);
    var bodyTop = Math.min(yO, yC), bodyH = Math.abs(yC - yO);
    var col = bull ? UP : DOWN;

    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" style="max-width:100%">';
    // 价格阶梯（右缘）
    [[k.h, '最高 ' + k.h], [Math.max(k.o, k.c), bull ? '收 ' + k.c : '开 ' + k.o], [Math.min(k.o, k.c), bull ? '开 ' + k.o : '收 ' + k.c], [k.l, '最低 ' + k.l]].forEach(function (t) {
      s += '<line x1="' + mainX + '" y1="' + y(t[0]) + '" x2="' + (mainX + 70) + '" y2="' + y(t[0]) + '" stroke="' + FAINT + '" stroke-width="1" stroke-dasharray="3 4"/>';
      s += '<text x="' + (mainX + 76) + '" y="' + (y(t[0]) + 4) + '" font-family="' + SANS + '" font-size="11.5" fill="' + MUTED + '">' + t[1] + '</text>';
    });
    // 主K线
    s += '<line x1="' + mainX + '" y1="' + yH + '" x2="' + mainX + '" y2="' + bodyTop + '" stroke="' + col + '" stroke-width="2.5"/>';
    s += '<line x1="' + mainX + '" y1="' + (bodyTop + bodyH) + '" x2="' + mainX + '" y2="' + yL + '" stroke="' + col + '" stroke-width="2.5"/>';
    s += '<rect x="' + (mainX - bw / 2) + '" y="' + bodyTop + '" width="' + bw + '" height="' + bodyH + '" rx="2" fill="' + (bull ? 'none' : col) + '" stroke="' + col + '" stroke-width="1.5"/>';
    // 维度括注（左缘）
    var bx = mainX - bw / 2 - 10;
    s += '<line x1="' + bx + '" y1="' + yH + '" x2="' + bx + '" y2="' + bodyTop + '" stroke="' + INK + '" stroke-width="1.2"/>';
    s += '<text x="' + (bx - 6) + '" y="' + ((yH + bodyTop) / 2 + 4) + '" text-anchor="end" font-family="' + SANS + '" font-size="12.5" fill="' + INK + '">上影线</text>';
    s += '<line x1="' + bx + '" y1="' + bodyTop + '" x2="' + bx + '" y2="' + (bodyTop + bodyH) + '" stroke="' + INK + '" stroke-width="1.2"/>';
    s += '<text x="' + (bx - 6) + '" y="' + (bodyTop + bodyH / 2 + 4) + '" text-anchor="end" font-family="' + SANS + '" font-size="13" font-weight="700" fill="' + INK + '">实体</text>';
    s += '<line x1="' + bx + '" y1="' + (bodyTop + bodyH) + '" x2="' + bx + '" y2="' + yL + '" stroke="' + INK + '" stroke-width="1.2"/>';
    s += '<text x="' + (bx - 6) + '" y="' + ((bodyTop + bodyH + yL) / 2 + 4) + '" text-anchor="end" font-family="' + SANS + '" font-size="12.5" fill="' + INK + '">下影线</text>';
    // 开/收刻度（主K线，无障碍第二重编码）
    s += '<line x1="' + (mainX + bw / 2 + 4) + '" y1="' + yO + '" x2="' + (mainX + bw / 2 + 12) + '" y2="' + yO + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<line x1="' + (mainX + bw / 2 + 4) + '" y1="' + yC + '" x2="' + (mainX + bw / 2 + 12) + '" y2="' + yC + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<text x="' + (mainX + bw / 2 + 16) + '" y="' + (yO + 4) + '" font-family="' + SANS + '" font-size="11.5" fill="' + INK + '">' + (bull ? '开' : '收') + '</text>';
    s += '<text x="' + (mainX + bw / 2 + 16) + '" y="' + (yC + 4) + '" font-family="' + SANS + '" font-size="11.5" fill="' + INK + '">' + (bull ? '收' : '开') + '</text>';
    // 对照K线（右，小一号，无标注）
    var g = candle(k2, { w: 120, h: 200, ticks: 'mark' });
    s += g.svg.replace('<svg ', '<svg x="' + (ghostX - 60) + '" y="25" width="120" height="200" ');
    s += '<text x="' + ghostX + '" y="' + (h - 6) + '" text-anchor="middle" font-family="' + SANS + '" font-size="12" fill="' + MUTED + '">' + (bull ? '阳线（收高于开）' : '阴线（收低于开）') + '</text>';
    s += '</svg>';
    return s;
  }

  /* 多根K线序列：共享价格刻度。opts: {w,h,caps:[每根下方文字], hl:高亮第i根(下划线)} */
  function row(candles, opts) {
    opts = opts || {};
    var n = candles.length;
    var w = opts.w || Math.max(260, n * 54), h = opts.h || 190;
    var hasCaps = opts.caps && opts.caps.some(function (c) { return c; });
    var capH = (hasCaps || opts.hl != null) ? 32 : 14;
    var pad = 12;
    var lo = Infinity, hi = -Infinity;
    candles.forEach(function (k) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; });
    var range = (hi - lo) || 1;
    var step = w / n, bw = Math.min(step * 0.52, 30);
    var y = function (p) { return pad + (1 - (p - lo) / range) * (h - pad * 2 - capH); };
    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img">';
    candles.forEach(function (k, i) {
      var bull = k.c >= k.o, col = bull ? UP : DOWN;
      var cx = step * (i + 0.5);
      var yO = y(k.o), yC = y(k.c);
      var bodyTop = Math.min(yO, yC), bodyH = Math.max(Math.abs(yC - yO), 2.5);
      s += '<line x1="' + cx + '" y1="' + y(k.h) + '" x2="' + cx + '" y2="' + bodyTop + '" stroke="' + col + '" stroke-width="2"/>';
      s += '<line x1="' + cx + '" y1="' + (bodyTop + bodyH) + '" x2="' + cx + '" y2="' + y(k.l) + '" stroke="' + col + '" stroke-width="2"/>';
      s += '<rect x="' + (cx - bw / 2) + '" y="' + bodyTop + '" width="' + bw + '" height="' + bodyH + '" rx="2" fill="' + (bull ? 'none' : col) + '" stroke="' + col + '" stroke-width="' + (bull ? 1.4 : 0) + '"/>';
      if (hasCaps && opts.caps[i]) s += '<text x="' + cx + '" y="' + (h - 8) + '" text-anchor="middle" font-family="' + SANS + '" font-size="11" fill="' + MUTED + '">' + opts.caps[i] + '</text>';
      if (opts.hl === i) s += '<line x1="' + (cx - bw / 2) + '" y1="' + (h - capH + 15) + '" x2="' + (cx + bw / 2) + '" y2="' + (h - capH + 15) + '" stroke="' + INK + '" stroke-width="2.5"/>';
    });
    s += '</svg>';
    return s;
  }

  /* ---------- v2：完整图表 ---------- */
  function fmtPrice(v, range) {
    var dec = range < 4 ? 2 : (range < 40 ? 1 : 0);
    return Number(v.toFixed(dec)).toString();
  }

  function chart(candles, opts) {
    opts = opts || {};
    var n = candles.length;
    if (!n) return '';
    var reveal = opts.reveal == null ? n : Math.max(1, Math.min(n, opts.reveal));
    var w = opts.w || 640, h = opts.h || 280;
    var hasCaps = opts.caps && opts.caps.some(function (c) { return c; });
    var capH = (hasCaps || opts.hl != null) ? 30 : 12;
    var volH = opts.vol ? Math.round(h * 0.17) : 0;
    var hasLevels = !!(opts.levels && opts.levels.length);
    var padT = 16, padL = 10, padR = (hasLevels || opts.yLabels) ? 52 : 10;
    var plotW = w - padL - padR;
    var plotH = h - padT - volH - capH;

    // 刻度永远按全集计算（reveal 揭示时图不跳动）
    var lo = Infinity, hi = -Infinity;
    candles.forEach(function (k) { if (k.l < lo) lo = k.l; if (k.h > hi) hi = k.h; });
    (opts.levels || []).forEach(function (L) { if (L.y < lo) lo = L.y; if (L.y > hi) hi = L.y; });
    (opts.zones || []).forEach(function (Z) {
      var zl = Math.min(Z.y1, Z.y2), zh = Math.max(Z.y1, Z.y2);
      if (zl < lo) lo = zl; if (zh > hi) hi = zh;
    });
    var range = (hi - lo) || 1;
    var y = function (p) { return padT + (1 - (p - lo) / range) * plotH; };
    var step = plotW / n, bw = Math.min(step * 0.6, 26);

    var s = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" style="max-width:100%">';

    // 区域底纹（支撑/阻力区）
    (opts.zones || []).forEach(function (Z) {
      var zc = Z.color || '#8a6d1f';
      var yTop = y(Math.max(Z.y1, Z.y2)), yBot = y(Math.min(Z.y1, Z.y2));
      s += '<rect x="' + padL + '" y="' + yTop + '" width="' + plotW + '" height="' + Math.max(yBot - yTop, 2) +
        '" fill="' + zc + '" fill-opacity="0.08"/>';
      s += '<line x1="' + padL + '" y1="' + yTop + '" x2="' + (padL + plotW) + '" y2="' + yTop + '" stroke="' + zc + '" stroke-width="1" stroke-dasharray="2 5" stroke-opacity="0.7"/>';
      s += '<line x1="' + padL + '" y1="' + yBot + '" x2="' + (padL + plotW) + '" y2="' + yBot + '" stroke="' + zc + '" stroke-width="1" stroke-dasharray="2 5" stroke-opacity="0.7"/>';
      if (Z.label) s += '<text x="' + (padL + 4) + '" y="' + (yTop - 3) + '" font-family="' + SANS + '" font-size="10.5" fill="' + zc + '">' + Z.label + '</text>';
    });

    // 水平位虚线
    (opts.levels || []).forEach(function (L) {
      var lc = L.color || MUTED;
      s += '<line x1="' + padL + '" y1="' + y(L.y) + '" x2="' + (padL + plotW) + '" y2="' + y(L.y) +
        '" stroke="' + lc + '" stroke-width="1.3" stroke-dasharray="' + (L.dash || '6 5') + '"/>';
      if (L.label) s += '<text x="' + (padL + plotW + 5) + '" y="' + (y(L.y) + 3.5) + '" font-family="' + SANS + '" font-size="10.5" fill="' + lc + '">' + L.label + '</text>';
    });

    // 右侧价格刻度
    if (opts.yLabels) {
      [0, 1, 2, 3].forEach(function (i) {
        var p = lo + range * i / 3;
        s += '<line x1="' + padL + '" y1="' + y(p) + '" x2="' + (padL + plotW) + '" y2="' + y(p) + '" stroke="#e4e2d9" stroke-width="1"/>';
        s += '<text x="' + (padL + plotW + 5) + '" y="' + (y(p) + 3.5) + '" font-family="' + SANS + '" font-size="10" fill="' + FAINT + '">' + fmtPrice(p, range) + '</text>';
      });
    }

    // 斜线（趋势线/通道线）：{i1,p1,i2,p2,color,dash,label}，i 为 0-based 棒索引
    (opts.lines || []).forEach(function (L) {
      var lc = L.color || '#8a6d1f';
      var x1 = padL + step * (L.i1 + 0.5), x2 = padL + step * (L.i2 + 0.5);
      s += '<line x1="' + x1 + '" y1="' + y(L.p1) + '" x2="' + x2 + '" y2="' + y(L.p2) +
        '" stroke="' + lc + '" stroke-width="1.4" stroke-dasharray="' + (L.dash || '7 5') + '"/>';
      if (L.label) s += '<text x="' + (x2 + 4) + '" y="' + (y(L.p2) - 4) + '" font-family="' + SANS + '" font-size="10.5" fill="' + lc + '">' + L.label + '</text>';
    });

    // K线（仅前 reveal 根）
    candles.forEach(function (k, i) {
      if (i >= reveal) return;
      var bull = k.c >= k.o, col = bull ? UP : DOWN;
      var cx = padL + step * (i + 0.5);
      var yO = y(k.o), yC = y(k.c);
      var bodyTop = Math.min(yO, yC), bodyH = Math.max(Math.abs(yC - yO), 2.2);
      s += '<line x1="' + cx + '" y1="' + y(k.h) + '" x2="' + cx + '" y2="' + bodyTop + '" stroke="' + col + '" stroke-width="1.7"/>';
      s += '<line x1="' + cx + '" y1="' + (bodyTop + bodyH) + '" x2="' + cx + '" y2="' + y(k.l) + '" stroke="' + col + '" stroke-width="1.7"/>';
      s += '<rect x="' + (cx - bw / 2) + '" y="' + bodyTop + '" width="' + bw + '" height="' + bodyH + '" rx="1.5" fill="' + (bull ? 'none' : col) + '" stroke="' + col + '" stroke-width="' + (bull ? 1.4 : 0) + '"/>';
      if (hasCaps && opts.caps[i]) s += '<text x="' + cx + '" y="' + (h - 7) + '" text-anchor="middle" font-family="' + SANS + '" font-size="10.5" fill="' + MUTED + '">' + opts.caps[i] + '</text>';
      if (opts.hl === i && reveal === n) s += '<line x1="' + (cx - bw / 2) + '" y1="' + (h - capH + 14) + '" x2="' + (cx + bw / 2) + '" y2="' + (h - capH + 14) + '" stroke="' + INK + '" stroke-width="2.5"/>';
    });

    // 结构标注（摆动点等）
    (opts.marks || []).forEach(function (M) {
      if (M.i >= reveal) return;
      var k = candles[M.i];
      var cx = padL + step * (M.i + 0.5);
      if ((M.pos || 'above') === 'above') {
        s += '<text x="' + cx + '" y="' + (y(k.h) - 7) + '" text-anchor="middle" font-family="' + SANS + '" font-size="10.5" font-weight="700" fill="' + INK + '">' + M.text + '</text>';
      } else {
        s += '<text x="' + cx + '" y="' + (y(k.l) + 15) + '" text-anchor="middle" font-family="' + SANS + '" font-size="10.5" font-weight="700" fill="' + INK + '">' + M.text + '</text>';
      }
    });

    // 量能柱（颜色随K线方向；比例尺为全集最大值）
    if (opts.vol) {
      var vMax = 0;
      for (var vi = 0; vi < n; vi++) if (opts.vol[vi] > vMax) vMax = opts.vol[vi];
      var volTop = padT + plotH + 6, volBot = h - capH;
      s += '<line x1="' + padL + '" y1="' + volTop + '" x2="' + (padL + plotW) + '" y2="' + volTop + '" stroke="#e4e2d9" stroke-width="1"/>';
      for (var i = 0; i < reveal && i < n; i++) {
        var k = candles[i];
        var vh = vMax > 0 ? (opts.vol[i] / vMax) * (volBot - volTop - 4) : 0;
        var col = (k.c >= k.o) ? UP : DOWN;
        var cx = padL + step * (i + 0.5);
        s += '<rect x="' + (cx - bw * 0.32) + '" y="' + (volBot - vh) + '" width="' + (bw * 0.64) + '" height="' + Math.max(vh, 1) +
          '" fill="' + col + '" fill-opacity="0.5"/>';
      }
    }

    s += '</svg>';
    return s;
  }

  /* ---------- v2：交互式逐根揭示训练器 ---------- */
  function playback(sel, candles, opts) {
    opts = opts || {};
    var root = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!root) return;
    var k = Math.max(1, Math.min(candles.length, opts.start == null ? 1 : opts.start));

    function draw() {
      var o = {};
      for (var key in opts) if (key !== 'start') o[key] = opts[key];
      o.reveal = k;
      root.innerHTML =
        '<div class="pb-chart">' + chart(candles, o) + '</div>' +
        '<div class="pb-ctrl"><span class="pb-count">已揭示 ' + k + ' / ' + candles.length + ' 根</span>' +
        '<button type="button" class="pb-btn" data-a="prev">← 退一根</button>' +
        '<button type="button" class="pb-btn pb-next" data-a="next">下一根 →</button>' +
        '<button type="button" class="pb-btn" data-a="reset">⟲ 重播</button></div>';
      root.querySelector('[data-a="next"]').disabled = k >= candles.length;
      root.querySelector('[data-a="prev"]').disabled = k <= 1;
      root.querySelector('[data-a="next"]').onclick = function () { k = Math.min(candles.length, k + 1); draw(); };
      root.querySelector('[data-a="prev"]').onclick = function () { k = Math.max(1, k - 1); draw(); };
      root.querySelector('[data-a="reset"]').onclick = function () { k = 1; draw(); };
    }
    draw();
  }

  window.Kbar = { candle: candle, anatomy: anatomy, row: row, chart: chart, playback: playback, UP: UP, DOWN: DOWN };
})();
