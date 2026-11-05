/* 불량 제품 파악 — 순수 로직 (브라우저·node 공용, 화면과 저장은 다른 파일)
   2차(2026-10-28) — 수강생 답(기획서 10장)에 맞춰 「자주 검사 CHECK SHEET」 양식 기준으로 바꿨습니다.
   · 규격 글자 읽기: 「420±1」 「48 +1.0/-0.5」 「1.5 MAX」 「MIN 40」 「8.00~8.10」 → 하한·상한 (단위는 따지지 않음)
   · 검사표 양식: 머리 칸(작성일·제작 공정명·모델명·품번·품명·관리 번호) + 항목 표(No·검사 항목·측정기·구분 LH/RH·호기 열·문제점)
     → PDF 글자 층이 있으면 자리(x·y)로 칸을 찾아 읽고, 없으면(스캔 그림) 사람이 옮기거나 AI 반자동
   · 식별: 모델·품번·호기는 검사표 「내용」에서, 파일 이름은 약한 힌트로만(이름 규칙이 없음 — 10장 ②)
   · 판정: 호기마다, 한 칸이라도 [하한, 상한] 밖이면 불합격(경계값 포함), 육안은 OK/NG
   · 출하일정 엑셀 ↔ 검사 기록 짝: 품번+호기, 없으면 모델+호기 → 검사표 없음 · 불합격 · 미판정
   · AI 판독 프롬프트(그림 첨부용)와 답(JSON) 읽기, 요약 프롬프트(품번·모델 가림) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QCLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* 판(版) — index.html 의 ?v= · app.js 의 APP_VERSION 과 같아야 합니다(scripts/bump-version.mjs 로 함께 올림).
     브라우저가 옛 logic.js 와 새 app.js 를 섞어 쓰면 app.js 가 이 값을 보고 계산을 멈춥니다. */
  var VERSION = '2026-10-28.1';

  // ── 작은 도구 ─────────────────────────────────────────────
  function str(v) { return v == null ? '' : String(v).trim(); }
  function round(x, d) { var p = Math.pow(10, d == null ? 4 : d); return Math.round(x * p) / p; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function fmtNum(x, d) { return isNum(x) ? String(round(x, d == null ? 4 : d)) : ''; }
  function pctText(x, d) { return isNum(x) ? (x * 100).toFixed(d == null ? 1 : d) + '%' : '-'; }
  /* 전각 숫자·기호를 반각으로 */
  function halfWidth(s) {
    return String(s).replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/　/g, ' ');
  }
  /* 비교용 낱말 — 공백·밑줄·하이픈·괄호·점을 빼고 소문자로 */
  function key(s) { return halfWidth(str(s)).toLowerCase().replace(/[\s_\-·.()\[\]:：]/g, ''); }
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ── 날짜 ─────────────────────────────────────────────────
  /* 여러 모양의 날짜 → 'YYYY-MM-DD'. 못 읽으면 ''. 엑셀 날짜(Date·일련번호)도 받습니다. */
  function toDate(v, refYear) {
    if (v == null || v === '') return '';
    if (v instanceof Date || Object.prototype.toString.call(v) === '[object Date]') {
      if (isNaN(v.getTime())) return '';
      var dd = new Date(v.getTime() + 12 * 3600 * 1000);   // 시간대 때문에 전날 23:59 로 들어오는 일이 있어 12시간을 더해 날짜만(data10-11 과 같은 방식)
      return ymd(dd.getFullYear(), dd.getMonth() + 1, dd.getDate());
    }
    if (typeof v === 'number' && v > 20000 && v < 80000) { // 엑셀 일련번호
      var d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    var s = halfWidth(str(v));
    var m;
    if ((m = /^(\d{4})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{2})(\d{2})(\d{2})$/.exec(s))) return ymd(2000 + +m[1], +m[2], +m[3]);
    if ((m = /^(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/.exec(s))) return ymd(2000 + +m[1], +m[2], +m[3]);
    if (refYear && (m = /^(\d{1,2})[.\-\/월](\d{1,2})일?$/.exec(s))) return ymd(refYear, +m[1], +m[2]);
    if (refYear && (m = /^(\d{2})(\d{2})$/.exec(s))) return ymd(refYear, +m[1], +m[2]);
    return '';
  }
  function ymd(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return '';
    var t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCMonth() !== mo - 1) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  /* 두 날짜('YYYY-MM-DD') 사이 날 수 — b 가 a 보다 뒤면 양수 */
  function daysBetween(a, b) {
    if (!a || !b) return null;
    var x = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)), y = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.round((y - x) / 86400000);
  }
  function dday(n) { return n == null ? '' : n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + (-n); }

  // ── 설정 ─────────────────────────────────────────────────
  var DEFAULT_SETTINGS = {
    inclusive: true,      // 하한·상한 값과 같으면 합격(10장 ④ — 공차 안은 합격)
    blankAs: 'hold',      // 'hold' = 빈 칸이 있으면 보류(미판정), 'ignore' = 적힌 칸만으로 판정
    checkAs: 'pass',      // 값 없이 체크(✓)만 한 칸: 'pass' = 확인한 것으로(합격), 'hold' = 값이 없어 보류
    nearPct: 10,          // 공차 폭의 몇 % 안이면 「경계 근처」
    maskAlias: true       // 요약 프롬프트에서 품번·모델 가리기
  };
  function cleanSettings(p) {
    var s = {}, k;
    for (k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
    if (!p || typeof p !== 'object') return s;
    if (typeof p.inclusive === 'boolean') s.inclusive = p.inclusive;
    if (p.blankAs === 'ignore' || p.blankAs === 'hold') s.blankAs = p.blankAs;
    if (p.checkAs === 'pass' || p.checkAs === 'hold') s.checkAs = p.checkAs;
    var n = Number(p.nearPct); if (p.nearPct !== '' && p.nearPct != null && isFinite(n) && n >= 0 && n <= 50) s.nearPct = n;
    if (typeof p.maskAlias === 'boolean') s.maskAlias = p.maskAlias;
    return s;
  }

  // ── 엑셀 머리행·열 찾기 ───────────────────────────────────
  var SHIP_FIELDS = [
    { id: 'date', label: '출하일', req: true, al: ['출하일', '출하예정일', '출하일자', '출하계획일', '납기', '납기일', '납품일', '일자', '날짜', 'date'] },
    { id: 'model', label: '모델', req: false, al: ['모델', '모델명', '기종', '차종', 'model'] },
    { id: 'part', label: '품번', req: false, al: ['품번', '품목코드', '품목번호', '제품코드', '부품번호', 'partno', 'part', 'pn', '자재코드'] },
    { id: 'hogi', label: '호기', req: true, al: ['호기', '호기수', '호기번호', '기번', '시리얼', '시리얼번호', '제조번호', 'serial', 'sn', 'serialno'] },
    { id: 'qty', label: '수량', req: false, al: ['수량', '출하수량', '납품수량', 'qty'] },
    { id: 'name', label: '품명', req: false, al: ['품명', '품목명', '제품명', '부품명', 'name'] }
  ];
  var SPEC_FIELDS = [
    { id: 'part', label: '품번', req: true, al: ['품번', '품목코드', '제품코드', '부품번호', 'partno', 'part', 'pn'] },
    { id: 'item', label: '검사 항목(또는 No)', req: true, al: ['검사항목', '항목', '측정항목', '검사내용', 'item', '특성', 'no'] },
    { id: 'lower', label: '하한', req: false, al: ['하한', '하한값', '최소', 'min', 'lsl', '하한규격'] },
    { id: 'upper', label: '상한', req: false, al: ['상한', '상한값', '최대', 'max', 'usl', '상한규격'] },
    { id: 'nominal', label: '기준값', req: false, al: ['기준값', '기준', '공칭', '공칭값', '규격값', 'nominal', '중심값', '규격'] },
    { id: 'tol', label: '공차(±)', req: false, al: ['공차', '공차±', '허용차', 'tol', 'tolerance'] },
    { id: 'unit', label: '단위', req: false, al: ['단위', 'unit'] },
    { id: 'kind', label: '판정 방식', req: false, al: ['판정방식', '판정', '방식', '구분', 'type'] }
  ];
  function matchFieldIn(fields, h) {
    var k = key(h).replace(/\(.*$/, '');
    if (!k) return '';
    var best = '', bestLen = 0;
    fields.forEach(function (f) {
      f.al.forEach(function (a) {
        var ak = key(a);
        if (k === ak && ak.length + 100 > bestLen) { best = f.id; bestLen = ak.length + 100; }
        else if (k.indexOf(ak) === 0 && ak.length >= 2 && ak.length > bestLen) { best = f.id; bestLen = ak.length; }
      });
    });
    return best;
  }
  /* aoa(배열의 배열)에서 머리행 찾기 — 앞 15줄 가운데 필수 칸을 가장 많이 맞춘 줄 */
  function detectColumns(aoa, fields) {
    var best = { headerRow: -1, map: {}, score: 0 };
    for (var r = 0; r < Math.min(15, aoa.length); r++) {
      var row = aoa[r] || [], map = {}, score = 0;
      for (var c = 0; c < row.length; c++) {
        var f = matchFieldIn(fields, row[c]);
        if (f && map[f] == null) { map[f] = c; score += fields.filter(function (x) { return x.id === f; })[0].req ? 3 : 1; }
      }
      if (score > best.score) best = { headerRow: r, map: map, score: score };
    }
    var missing = fields.filter(function (f) { return f.req && best.map[f.id] == null; }).map(function (f) { return f.label; });
    return { headerRow: best.headerRow, map: best.map, missing: missing, header: best.headerRow >= 0 ? (aoa[best.headerRow] || []).map(str) : [] };
  }
  /* 화면에서 고른 열 연결을 덮어쓰고 「못 찾은 필수 칸」을 다시 셉니다 */
  function applyOverride(det, override, fields) {
    if (override) Object.keys(override).forEach(function (k) { if (override[k] == null) delete det.map[k]; else det.map[k] = override[k]; });
    det.missing = fields.filter(function (f) { return f.req && det.map[f.id] == null; }).map(function (f) { return f.label; });
  }
  function isTotalRow(row) { return (row || []).some(function (v) { return /^(합\s*계|소\s*계|총\s*계|total)$/i.test(str(v)); }); }
  function cell(row, map, f) { return map[f] == null ? null : row[map[f]]; }

  /* 호기 칸 하나 → 호기 목록. 「314498~314500」 은 펼치고(100대까지), 「314498, 314499」 는 나눕니다. 엑셀 숫자도 받습니다. */
  function splitHogi(v) {
    if (v == null || v === '') return [];
    if (typeof v === 'number') return isFinite(v) ? [String(Math.round(v))] : [];
    var s = halfWidth(str(v)).replace(/호기$/,'');
    var m = /^([A-Za-z#\-]*)(\d+)\s*[~∼〜]\s*([A-Za-z#\-]*)(\d+)$/.exec(s);
    if (m && (m[3] === '' || m[3] === m[1])) {
      var a = +m[2], b = +m[4];
      if (b >= a && b - a <= 100) { var out = []; for (var i = a; i <= b; i++) { var t = String(i); while (t.length < m[2].length) t = '0' + t; out.push(m[1] + t); } return out; }
    }
    return s.split(/[,，、\/;]|\s+/).map(function (x) { return x.replace(/^#/, '').trim(); }).filter(Boolean);
  }
  /* 모델 칸에 「A / B」 처럼 여럿 적힌 경우 */
  function splitModels(v) { return halfWidth(str(v)).split(/\s*[\/,，、]\s*/).map(str).filter(Boolean); }

  /* 출하일정 aoa → { rows, warnings, det } */
  function parseShip(aoa, override) {
    var det = detectColumns(aoa, SHIP_FIELDS);
    applyOverride(det, override, SHIP_FIELDS);
    var rows = [], warnings = [];
    if (det.headerRow < 0) return { rows: rows, warnings: [{ row: 0, msg: '머리행(출하일 · 호기 칸)을 찾지 못했습니다.' }], det: det };
    if (det.map.part == null && det.map.model == null) warnings.push({ row: 0, msg: '품번 · 모델 칸이 둘 다 없습니다. 하나는 있어야 검사표와 짝지을 수 있습니다.' });
    var refYear = 0;
    for (var r = det.headerRow + 1; r < aoa.length; r++) {
      var row = aoa[r] || [];
      if (!row.some(function (v) { return str(v) !== ''; }) || isTotalRow(row)) continue;
      var part = str(cell(row, det.map, 'part')), model = str(cell(row, det.map, 'model'));
      var date = toDate(cell(row, det.map, 'date'), refYear);
      if (date) refYear = +date.slice(0, 4);
      var hogis = splitHogi(cell(row, det.map, 'hogi'));
      if (!part && !model) { warnings.push({ row: r + 1, msg: '품번 · 모델이 비어 건너뜁니다.' }); continue; }
      if (!hogis.length) { warnings.push({ row: r + 1, msg: '호기가 비어 건너뜁니다(호기가 있어야 검사표와 짝지을 수 있습니다).' }); continue; }
      if (!date) warnings.push({ row: r + 1, msg: '출하일을 읽지 못했습니다(' + str(cell(row, det.map, 'date')) + ').' });
      var q = parseNumber(cell(row, det.map, 'qty'));
      hogis.forEach(function (hg) {
        rows.push({ date: date, model: model, part: part, hogi: hg, qty: hogis.length > 1 ? 1 : (q.ok ? q.value : null), name: str(cell(row, det.map, 'name')), row: r + 1 });
      });
    }
    var seen = {}, uniq = [];
    rows.forEach(function (x) {
      var k = (x.part ? 'p:' + key(x.part) : 'm:' + key(x.model)) + '|' + key(x.hogi);
      if (seen[k]) { warnings.push({ row: x.row, msg: '같은 ' + (x.part ? '품번' : '모델') + ' · 호기(' + x.hogi + ')가 두 번 있습니다. 하나로 봅니다.' }); return; }
      seen[k] = 1; uniq.push(x);
    });
    return { rows: uniq, warnings: warnings, det: det };
  }

  /* 스펙 덮어쓰기 표 aoa → { rows, warnings, det } — 검사표에 적힌 규격보다 먼저 씁니다(선택) */
  function parseSpec(aoa, override) {
    var det = detectColumns(aoa, SPEC_FIELDS);
    applyOverride(det, override, SPEC_FIELDS);
    var rows = [], warnings = [];
    if (det.headerRow < 0) return { rows: rows, warnings: [{ row: 0, msg: '머리행(품번 · 검사 항목 칸)을 찾지 못했습니다.' }], det: det };
    var lastPart = '';
    for (var r = det.headerRow + 1; r < aoa.length; r++) {
      var row = aoa[r] || [];
      if (!row.some(function (v) { return str(v) !== ''; })) continue;
      var part = str(cell(row, det.map, 'part')) || lastPart; // 병합 셀처럼 품번이 위에만 있는 표
      lastPart = part;
      var sp = cleanSpec({
        part: part, item: cell(row, det.map, 'item'), lower: cell(row, det.map, 'lower'), upper: cell(row, det.map, 'upper'),
        nominal: cell(row, det.map, 'nominal'), tol: cell(row, det.map, 'tol'), unit: cell(row, det.map, 'unit'), kind: cell(row, det.map, 'kind')
      });
      if (sp.error) { warnings.push({ row: r + 1, msg: sp.error }); if (!sp.item) continue; }
      rows.push(sp);
    }
    return { rows: rows, warnings: warnings, det: det };
  }
  /* 덮어쓰기 한 줄 정리 — 기준값±공차, 또는 기준값 칸에 「420±1」 같은 규격 글자만 있어도 하한·상한을 계산합니다 */
  function cleanSpec(p) {
    var sp = { part: str(p.part), item: str(p.item), lower: null, upper: null, unit: str(p.unit), kind: 'num', error: '' };
    if (/^(ok|okng|육안|외관|유무|합불)/.test(key(p.kind))) sp.kind = 'okng';
    var lo = parseNumber(p.lower), hi = parseNumber(p.upper), no = parseNumber(p.nominal);
    var tol = parseNumber(halfWidth(str(p.tol)).replace(/^±/, ''));
    if (lo.ok) sp.lower = lo.value;
    if (hi.ok) sp.upper = hi.value;
    if (no.ok && tol.ok && sp.lower == null && sp.upper == null) { sp.lower = round(no.value - Math.abs(tol.value), 6); sp.upper = round(no.value + Math.abs(tol.value), 6); }
    if (sp.lower == null && sp.upper == null && sp.kind === 'num') {
      var ps = parseSpecString(str(p.nominal) || str(p.item));
      if (ps.ok) { sp.lower = ps.lower; sp.upper = ps.upper; if (!sp.unit) sp.unit = ps.unit; }
    }
    if (!sp.unit) sp.unit = lo.unit || hi.unit || no.unit || '';
    if (!sp.item) sp.error = '검사 항목이 비어 있습니다.';
    else if (sp.kind === 'num' && sp.lower == null && sp.upper == null) {
      if (/^(ok|ng|양호|합격|육안)/i.test(str(p.lower) + str(p.upper) + str(p.nominal))) sp.kind = 'okng';
      else sp.error = '「' + sp.item + '」 에 하한 · 상한(또는 기준값과 공차)이 없어 판정할 수 없습니다. 육안 항목이면 판정 방식을 「OK/NG」로 적어 주세요.';
    }
    if (sp.lower != null && sp.upper != null && sp.lower > sp.upper) { var t = sp.lower; sp.lower = sp.upper; sp.upper = t; sp.error = '「' + sp.item + '」 하한이 상한보다 커서 바꿔 넣었습니다.'; }
    return sp;
  }
  function specText(s) {
    if (!s) return '-';
    if (s.kind === 'okng') return '육안 OK/NG';
    var u = s.unit ? ' ' + s.unit : '';
    if (s.lower != null && s.upper != null) return fmtNum(s.lower) + ' ~ ' + fmtNum(s.upper) + u;
    if (s.lower != null) return fmtNum(s.lower) + u + ' 이상';
    if (s.upper != null) return fmtNum(s.upper) + u + ' 이하';
    return '규격 없음';
  }

  // ── 규격 글자 읽기 ────────────────────────────────────────
  var NUM_RE = '(\\d+(?:[.,]\\d+)?|[.,]\\d+)';
  var UNIT_RE = '\\s*(mm|㎜|cm|㎝|μm|µm|um|㎛|kg|㎏|g|mg|°|%|hrc|hb|kgf|nm|n|m)?';
  function toN(s) { return Number(String(s).replace(',', '.')); }
  /* 「420±1」 「48 +1.0/-0.5」 「1.5 MAX」 「MIN 40」 「8.00~8.10」 → { ok, lower, upper, nominal, unit }.
     앞에 붙은 항목 이름(「길이 420±1」)·지름 기호(Φ)는 건너뛰고, 단위는 적혀 있으면 기억만 합니다(비교는 숫자끼리). */
  function parseSpecString(text) {
    var out = { ok: false, lower: null, upper: null, nominal: null, unit: '', text: str(text) };
    var s = halfWidth(str(text)).replace(/[−–]/g, '-').replace(/\s+/g, ' ').replace(/[ΦφØø⌀]\s*/g, '');
    if (!s) return out;
    var m;
    function done(lo, hi, no, unit) { out.ok = true; out.lower = lo == null ? null : round(lo, 6); out.upper = hi == null ? null : round(hi, 6); out.nominal = no; out.unit = str(unit).toLowerCase() === 'um' ? 'μm' : str(unit); return out; }
    // 1) 대칭 공차 420±1 · 420 +/- 1 · 420+-1
    if ((m = new RegExp(NUM_RE + '\\s*(?:±|\\+\\s*/\\s*-|\\+\\s*-)\\s*' + NUM_RE + UNIT_RE, 'i').exec(s))) {
      var n1 = toN(m[1]), t1 = Math.abs(toN(m[2]));
      return done(n1 - t1, n1 + t1, n1, m[3]);
    }
    // 2) 비대칭 공차 48 +1.0/-0.5 · 48(+1.0, -0.5) · 48 -0.5/+1.0 · 48 +0/-0.2
    if ((m = new RegExp(NUM_RE + '\\s*\\(?\\s*\\+\\s*' + NUM_RE + '\\s*[/,]?\\s*-\\s*' + NUM_RE + '\\s*\\)?' + UNIT_RE, 'i').exec(s))) {
      var n2 = toN(m[1]);
      return done(n2 - toN(m[3]), n2 + toN(m[2]), n2, m[4]);
    }
    if ((m = new RegExp(NUM_RE + '\\s*\\(?\\s*-\\s*' + NUM_RE + '\\s*[/,]?\\s*\\+\\s*' + NUM_RE + '\\s*\\)?' + UNIT_RE, 'i').exec(s))) {
      var n3 = toN(m[1]);
      return done(n3 - toN(m[2]), n3 + toN(m[3]), n3, m[4]);
    }
    // 3) 범위 8.00~8.10
    if ((m = new RegExp(NUM_RE + UNIT_RE + '\\s*[~∼〜]\\s*' + NUM_RE + UNIT_RE, 'i').exec(s))) {
      var a = toN(m[1]), b = toN(m[3]);
      return done(Math.min(a, b), Math.max(a, b), null, m[4] || m[2]);
    }
    // 4) 상한만 — MAX 1.5 · 1.5 MAX · 최대 1.5 · 1.5 이하
    if ((m = new RegExp('(?:max|최대)\\.?\\s*:?\\s*' + NUM_RE + UNIT_RE, 'i').exec(s)) || (m = new RegExp(NUM_RE + UNIT_RE + '\\s*(?:max|최대|이하)', 'i').exec(s))) {
      return done(null, toN(m[1]), null, m[2]);
    }
    // 5) 하한만 — MIN 40 · 40 MIN · 최소 40 · 40 이상
    if ((m = new RegExp('(?:min|최소)\\.?\\s*:?\\s*' + NUM_RE + UNIT_RE, 'i').exec(s)) || (m = new RegExp(NUM_RE + UNIT_RE + '\\s*(?:min|최소|이상)', 'i').exec(s))) {
      return done(toN(m[1]), null, null, m[2]);
    }
    return out;
  }

  // ── 값 읽기 · 단위 ────────────────────────────────────────
  var UNITS = {
    mm: ['len', 1], '㎜': ['len', 1], cm: ['len', 10], '㎝': ['len', 10], m: ['len', 1000], um: ['len', 0.001], 'μm': ['len', 0.001], 'µm': ['len', 0.001], '㎛': ['len', 0.001],
    g: ['mass', 1], kg: ['mass', 1000], '㎏': ['mass', 1000], mg: ['mass', 0.001]
  };
  function unitInfo(u) {
    var k = str(u).replace(/\s/g, '');
    if (!k) return null;
    var hit = UNITS[k] || UNITS[k.toLowerCase()];
    return hit ? { fam: hit[0], f: hit[1] } : { fam: 'other:' + k.toLowerCase(), f: 1 };
  }
  var CHECK_RE = /^[✓✔√☑]$|^v$/i;
  /* 손으로 적은 값 → { ok, value, unit, raw, blank, okng, check } */
  function parseNumber(v) {
    var out = { ok: false, value: null, unit: '', raw: v == null ? '' : String(v), blank: false, okng: '', check: false };
    if (typeof v === 'number') { if (isFinite(v)) { out.ok = true; out.value = v; } return out; }
    var s = halfWidth(str(v)).replace(/\s+/g, '');
    if (!s || /^[-–—/]$/.test(s) || /^(미측정|없음|n\/?a)$/i.test(s)) { out.blank = true; return out; }
    if (CHECK_RE.test(s)) { out.check = true; return out; }
    if (/^(ok|o\.k|양호|합격|양|○|◯|o|pass|good)$/i.test(s)) { out.okng = 'OK'; return out; }
    if (/^(ng|n\.g|불량|불합격|불|×|x|✕|fail)$/i.test(s)) { out.okng = 'NG'; return out; }
    var m = /^([+\-−]?)(\d+(?:[.,]\d+)*|\.\d+)([a-zA-Zµμ㎜㎝㎛㎏°%]*)$/.exec(s);
    if (!m) return out;
    var num = m[2];
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(num)) num = num.replace(/,/g, '');   // 1,234.5
    else if (/^\d+,\d+$/.test(num)) num = num.replace(',', '.');              // 12,5 → 12.5 (손글씨 쉼표)
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(num)) return out;
    out.value = Number(num) * (m[1] && m[1] !== '+' ? -1 : 1);
    out.unit = m[3] || '';
    out.ok = isFinite(out.value);
    return out;
  }

  // ── 판정 ─────────────────────────────────────────────────
  var EPS = 1e-9;
  /* 칸 하나 판정 → { status: 'pass'|'fail'|'blank'|'unread'|'nospec', value, msg, near, side, check }
     spec = { kind: 'num'|'okng', lower, upper, unit } — 하한·상한이 둘 다 없으면 「규격 없음」 */
  function judgeItem(spec, raw, settings) {
    var S = cleanSettings(settings);
    var p = parseNumber(raw);
    var r = { status: 'unread', value: null, msg: '', near: false, side: '', raw: p.raw, check: false };
    if (p.blank || (p.raw.trim() === '' && !p.okng)) { r.status = 'blank'; r.msg = '빈 칸'; return r; }
    if (p.check) {
      r.check = true;
      if (spec.kind === 'okng' || S.checkAs === 'pass') { r.status = 'pass'; r.value = '체크'; r.msg = spec.kind === 'okng' ? '' : '체크만(값 없음)'; return r; }
      r.msg = '체크만 적혀 값이 없음'; return r;
    }
    if (spec.kind === 'okng') {
      if (p.okng) { r.status = p.okng === 'OK' ? 'pass' : 'fail'; r.value = p.okng; r.msg = p.okng === 'NG' ? 'NG 로 적힘' : ''; return r; }
      r.msg = 'OK/NG 로 읽지 못함'; return r;
    }
    if (p.okng) {
      if (p.okng === 'NG') { r.status = 'fail'; r.value = 'NG'; r.msg = 'NG 로 적힘'; return r; }
      if (S.checkAs === 'pass') { r.status = 'pass'; r.value = 'OK'; r.check = true; r.msg = 'OK 만(값 없음)'; return r; }
      r.msg = '수치 항목인데 OK 만 적힘'; return r;
    }
    if (!p.ok) { r.msg = '숫자로 읽지 못함'; return r; }
    var v = p.value;
    if (p.unit) {
      var a = unitInfo(p.unit), b = unitInfo(spec.unit);
      if (b && a.fam === b.fam) v = round(v * a.f / b.f, 9);
      else if (b && a.fam !== b.fam) { r.msg = '단위가 기준(' + spec.unit + ')과 다름: ' + p.unit; return r; }
    }
    r.value = v;
    var lo = spec.lower, hi = spec.upper;
    if (lo == null && hi == null) { r.status = 'nospec'; r.msg = '규격을 읽지 못함 — ⑤ 스펙에서 넣어 주세요'; return r; }
    var e = EPS * Math.max(1, Math.abs(v));
    var below = lo != null && (S.inclusive ? v < lo - e : v <= lo + e);
    var above = hi != null && (S.inclusive ? v > hi + e : v >= hi - e);
    if (below) { r.status = 'fail'; r.side = 'low'; r.msg = '하한 ' + fmtNum(lo) + ' 보다 ' + fmtNum(round(lo - v, 6)) + ' 작음'; return r; }
    if (above) { r.status = 'fail'; r.side = 'high'; r.msg = '상한 ' + fmtNum(hi) + ' 보다 ' + fmtNum(round(v - hi, 6)) + ' 큼'; return r; }
    r.status = 'pass';
    if (lo != null && hi != null && S.nearPct > 0) {
      var nd = (hi - lo) * S.nearPct / 100;
      if (v - lo <= nd + e || hi - v <= nd + e) { r.near = true; r.msg = '경계 근처'; }
    }
    return r;
  }

  // ── 검사표 양식 ───────────────────────────────────────────
  /* 「자주 검사 CHECK SHEET」 (10장 ① 첨부 양식) — 머리 칸과 항목 표 칸 이름. 실제 값(모델·품번 등)은 리포에 두지 않습니다. */
  var TEMPLATE = {
    id: 'self-check', name: '자주 검사 CHECK SHEET',
    header: [
      { id: 'date', label: '작성일', al: ['작성일', '작성일자', '검사일'] },
      { id: 'process', label: '제작 공정명', al: ['제작공정명', '공정명'] },
      { id: 'model', label: '모델명', al: ['모델명', '모델'] },
      { id: 'part', label: '품번', al: ['품번'] },
      { id: 'name', label: '품명', al: ['품명'] },
      { id: 'mgmt', label: '관리 번호', al: ['관리번호'] }
    ],
    subs: ['LH', 'RH', 'FR', 'RE', '좌', '우', '전', '후', '상', '하']
  };
  var META_IDS = TEMPLATE.header.map(function (f) { return f.id; });
  var SUB_RE = new RegExp('^(' + TEMPLATE.subs.join('|') + ')$', 'i');
  function headerField(k) {
    for (var i = 0; i < TEMPLATE.header.length; i++) if (TEMPLATE.header[i].al.some(function (a) { return key(a) === k; })) return TEMPLATE.header[i].id;
    return '';
  }
  /* 칸 열쇠 — 「2 LH」, 구분이 없으면 「2」 */
  function cellKey(no, sub) { return str(no) + (str(sub) ? ' ' + str(sub).toUpperCase() : ''); }
  function itemCells(items) {
    var out = [];
    (items || []).forEach(function (it) { (it.subs && it.subs.length ? it.subs : ['']).forEach(function (sb) { out.push({ item: it, sub: sb, key: cellKey(it.no, sb) }); }); });
    return out;
  }
  /* 항목 정리 — 규격이 읽히지 않고 측정기가 육안 · 이름이 외관이면 OK/NG */
  function cleanItem(it, i) {
    var o = { no: str(it && it.no) || String(i + 1), label: str(it && it.label), tool: str(it && it.tool), subs: [], kind: '' };
    var subs = Array.isArray(it && it.subs) ? it.subs : String((it && it.subs) || '').split(/[,\/\s]+/);
    subs.forEach(function (s) { s = str(s).toUpperCase(); if (s && o.subs.indexOf(s) < 0) o.subs.push(s); });
    o.kind = it && (it.kind === 'okng' || it.kind === 'num') ? it.kind
      : (!parseSpecString(o.label).ok && (/육안/.test(o.tool) || /외관|육안|방향|유무/.test(o.label))) ? 'okng' : 'num';
    return o;
  }

  /* pdf.js 의 getTextContent() 글자 조각 → { s, x, y(위에서부터, 글자 가운데), w, h, cx } */
  function normTextItems(items, pageHeight) {
    return (items || []).map(function (t) {
      var tr = t.transform || [1, 0, 0, 1, 0, 0], hgt = Math.abs(t.height || tr[3] || 10);
      var x = tr[4], w = Math.abs(t.width || 0);
      return { s: halfWidth(str(t.str)), x: x, w: w, h: hgt, y: pageHeight - tr[5] - hgt * 0.35, cx: x + w / 2 };
    }).filter(function (t) { return t.s !== ''; });
  }
  function sameLine(a, b) { return Math.abs(a.y - b.y) <= Math.max(a.h, b.h) * 0.6; }

  /* 글자 층으로 검사표 읽기. items = normTextItems 결과.
     → { ok, template, reason, meta:{date,process,model,part,name,mgmt}, items:[{no,label,tool,subs,kind}], hogis:[{no,values}], problems:{no:글}, warnings }
     칸 찾기: 「No」 「검사 항목」 「측정기」 「호기수」 「문제점」 머리 글자의 x 자리로 열을, No 열의 숫자로 줄을 정하고,
     호기 번호(머리 줄)의 x 에 가장 가까운 값을 그 호기로, 같은 줄 안의 LH/RH 글자 y 에 가장 가까운 값을 그 구분으로 봅니다.
     「검사자」 줄 아래(서명)와 결재 칸은 읽지 않습니다. */
  function parseSheetText(items) {
    var out = { ok: false, template: '', reason: '', meta: {}, items: [], hogis: [], problems: {}, warnings: [], textCount: (items || []).length };
    var T = (items || []).map(function (t) { var o = {}; for (var k in t) o[k] = t[k]; o.k = key(t.s); return o; }).filter(function (t) { return t.k !== ''; });
    if (T.length < 8) { out.reason = 'notext'; return out; }
    out.template = T.some(function (t) { return /자주검사|checksheet/.test(t.k); }) ? TEMPLATE.id : '';
    // 머리 칸 — 「이름 : 값」 한 조각이거나, 같은 줄 오른쪽 조각들(다음 이름 칸 전까지)
    var labels = [];
    T.forEach(function (t) {
      var parts = t.s.split(/[:：]/), f = headerField(key(parts[0]));
      if (f) labels.push({ t: t, f: f, inline: parts.length > 1 ? parts.slice(1).join(':').trim() : null });
    });
    var isLabel = function (t) { return labels.some(function (l) { return l.t === t; }); };
    labels.sort(function (a, b) { return a.t.y - b.t.y || a.t.x - b.t.x; });
    labels.forEach(function (l) {
      if (out.meta[l.f]) return;
      var right = T.filter(function (u) { return u !== l.t && sameLine(u, l.t) && u.x >= l.t.x + l.t.w - 1; }).sort(function (a, b) { return a.x - b.x; });
      var vals = l.inline ? [l.inline] : [], edge = l.t.x + l.t.w;
      for (var i = 0; i < right.length; i++) {
        var gap = right[i].x - edge;
        if (isLabel(right[i]) || (vals.length && gap > 40) || (!vals.length && gap > 220)) break;   // 다음 이름 칸 · 멀리 떨어진 다른 칸(안내 글 등)에서 멈춤
        edge = right[i].x + right[i].w;
        if (!/^[:：]$/.test(right[i].s)) vals.push(right[i].s);
      }
      var v = vals.join(' ').replace(/^[:：]\s*/, '').trim();
      if (v) out.meta[l.f] = l.f === 'date' ? (toDate(v) || v) : v;
    });
    // 항목 표 머리
    var hItem = T.filter(function (t) { return t.k === '검사항목'; })[0];
    if (!hItem) { out.reason = 'nolayout'; out.ok = Object.keys(out.meta).length > 0; return out; }
    var near = function (arr) { return arr.sort(function (a, b) { return Math.abs(a.y - hItem.y) - Math.abs(b.y - hItem.y); })[0]; };
    var hNo = near(T.filter(function (t) { return t.k === 'no' && t.x < hItem.x; }));
    var hTool = near(T.filter(function (t) { return t.k === '측정기' && t.x > hItem.x; }));
    var hHogi = near(T.filter(function (t) { return /^호기(수|번호)?$/.test(t.k) && t.x > hItem.x; }));
    var hProb = near(T.filter(function (t) { return /^문제점/.test(t.k) && t.x > hItem.x; }));
    var hInsp = T.filter(function (t) { return t.k === '검사자' && t.y > hItem.y; }).sort(function (a, b) { return a.y - b.y; })[0];
    if (!hNo) { out.reason = 'nolayout'; out.ok = Object.keys(out.meta).length > 0; return out; }
    var heads = [hNo, hItem, hTool, hHogi].filter(Boolean);
    var headTop = Math.min.apply(null, heads.map(function (t) { return t.y; })) - 24;
    var headBot = Math.max.apply(null, heads.map(function (t) { return t.y; })) + 10;
    var bottom = hInsp ? hInsp.y - Math.max(4, hInsp.h * 0.6) : Infinity;
    var toolCx = hTool ? hTool.cx : hItem.x + hItem.w + 40;
    var probX = hProb ? hProb.x - 6 : Infinity;
    // 줄 기준 — No 열의 숫자
    var anchors = T.filter(function (t) { return /^\d{1,2}$/.test(t.s) && Math.abs(t.cx - hNo.cx) <= Math.max(14, hNo.w) && t.y > headBot && t.y < bottom; }).sort(function (a, b) { return a.y - b.y; });
    if (!anchors.length) { out.reason = 'norows'; out.ok = Object.keys(out.meta).length > 0; return out; }
    // 호기 번호 — 머리 줄, 측정기 열 오른쪽, 문제점 열 왼쪽
    var skipHead = /^(호기|호기수|측정기|문제점|조치사항|검사항목|no)$/;
    var hogiHeads = T.filter(function (t) {
      return t.y >= headTop && t.y <= headBot && t.cx > toolCx + 20 && t.x < probX && !skipHead.test(t.k) && /^[#A-Za-z0-9\-]{2,}$/.test(t.s.replace(/\s/g, ''));
    }).sort(function (a, b) { return a.cx - b.cx; });
    var colHalf = 40;
    for (var i = 1; i < hogiHeads.length; i++) colHalf = Math.min(colHalf, (hogiHeads[i].cx - hogiHeads[i - 1].cx) / 2);
    out.hogis = hogiHeads.map(function (t) { return { no: t.s.replace(/^#/, '').replace(/\s/g, ''), values: {} }; });
    var hogiLeft = hogiHeads.length ? hogiHeads[0].cx - Math.min(colHalf, (hogiHeads[0].cx - toolCx) / 2) : (hHogi ? hHogi.x : probX);
    var b1 = (hNo.cx + hItem.cx) / 2;
    var gaps = anchors.slice(1).map(function (a, j) { return a.y - anchors[j].y; });
    var typ = gaps.length ? Math.min.apply(null, gaps) : 40;
    var used = {};
    anchors.forEach(function (a, j) {
      var top = j === 0 ? Math.max(headBot, a.y - typ / 2 - 2) : (anchors[j - 1].y + a.y) / 2;
      var bot = j === anchors.length - 1 ? Math.min(bottom, a.y + typ / 2 + 2) : (a.y + anchors[j + 1].y) / 2;
      var band = T.filter(function (t) { return t !== a && t.y >= top && t.y < bot && t.x >= hNo.x - 10; });   // 표 왼쪽(도면 치수 글자)은 빼고
      var subs = band.filter(function (t) { return SUB_RE.test(t.s) && t.cx > toolCx - 10 && t.cx < (hogiHeads.length ? hogiHeads[0].cx - 8 : hogiLeft + 4); }).sort(function (x, y) { return x.y - y.y; });
      var lab = band.filter(function (t) { return t.cx > b1 && t.cx < (hItem.cx + toolCx) / 2 + 4 && subs.indexOf(t) < 0; }).sort(function (x, y) { return x.y - y.y || x.x - y.x; });
      var tool = band.filter(function (t) { return t.cx >= (hItem.cx + toolCx) / 2 + 4 && t.cx < hogiLeft && subs.indexOf(t) < 0; });
      var it = cleanItem({ no: a.s, label: lab.map(function (t) { return t.s; }).join(' ').replace(/\s+/g, ' '), tool: tool.map(function (t) { return t.s; }).join(' '), subs: subs.map(function (t) { return t.s; }) }, j);
      if (used[it.no]) { out.warnings.push('항목 번호 ' + it.no + ' 가 두 번 있습니다.'); return; }
      used[it.no] = 1;
      out.items.push(it);
      // 값 — 호기 열에 든 조각
      band.forEach(function (t) {
        if (subs.indexOf(t) >= 0 || lab.indexOf(t) >= 0 || tool.indexOf(t) >= 0) return;
        if (t.x >= probX) { out.problems[it.no] = ((out.problems[it.no] || '') + ' ' + t.s).trim(); return; }
        if (!hogiHeads.length) return;
        var best = -1, bd = Infinity;
        hogiHeads.forEach(function (hh, hi) { var d = Math.abs(t.cx - hh.cx); if (d < bd) { bd = d; best = hi; } });
        if (bd > colHalf * 1.2) { out.warnings.push('항목 ' + it.no + ' 의 「' + t.s + '」 는 어느 호기 열인지 몰라 건너뜁니다.'); return; }
        var sb = '';
        if (subs.length) { var sd = Infinity; subs.forEach(function (x) { var d = Math.abs(x.y - t.y); if (d < sd) { sd = d; sb = x.s.toUpperCase(); } }); }
        var ck = cellKey(it.no, sb), vals = out.hogis[best].values;
        vals[ck] = vals[ck] ? vals[ck] + ' ' + t.s : t.s;
      });
    });
    if (anchors.length && !hogiHeads.length) out.warnings.push('호기 번호(머리 줄)를 글자 층에서 찾지 못했습니다. 판독 화면에서 호기를 적어 주세요.');
    out.ok = out.items.length > 0;
    return out;
  }

  // ── 식별(모델 · 품번 · 호기) ─────────────────────────────
  /* 파일 이름 → 약한 힌트. 이름 규칙이 없으므로(10장 ②) 알려진 품번 · 모델 · 호기(출하일정 · 판독 기록)가 이름에 들어 있는지,
     「#314501」 처럼 # 뒤 번호만 봅니다. 날짜 같은 숫자를 호기로 잘못 읽지 않게, 아는 호기가 아니면 # 이 있어야 합니다. */
  function hintFromName(name, known) {
    known = known || {};
    var base = halfWidth(str(name)).replace(/^.*[\\/]/, '').replace(/\.pdf$/i, '').trim();
    var k = key(base), out = { model: '', part: '', hogi: '' };
    function longest(list) {
      var hit = '';
      (list || []).forEach(function (x) { var kx = key(x); if (kx.length >= 3 && k.indexOf(kx) >= 0 && kx.length > key(hit).length) hit = x; });
      return hit;
    }
    out.part = longest(known.parts);
    out.model = longest(known.models);
    var m = /#\s*([A-Za-z0-9\-]{3,})/.exec(base);
    if (m) out.hogi = m[1];
    else (known.hogis || []).slice().sort(function (a, b) { return String(b).length - String(a).length; }).some(function (hg) {
      hg = str(hg);
      if (hg.length < 3) return false;
      if (new RegExp('(^|[^0-9A-Za-z])' + escapeRe(hg) + '($|[^0-9A-Za-z])', 'i').test(base)) { out.hogi = hg; return true; }
      return false;
    });
    return out;
  }
  /* 알려진 품번 · 모델 · 호기 — 출하일정과 판독 끝난 기록에서 */
  function knownIds(ships, readings) {
    var parts = [], models = [], hogis = [];
    function push(arr, v) { v = str(v); if (v && arr.indexOf(v) < 0) arr.push(v); }
    (ships || []).forEach(function (s) { push(parts, s.part); splitModels(s.model).forEach(function (m) { push(models, m); }); push(hogis, s.hogi); });
    Object.keys(readings || {}).forEach(function (id) {
      var r = readings[id]; if (!r || !r.meta) return;
      push(parts, r.meta.part); splitModels(r.meta.model).forEach(function (m) { push(models, m); });
    });
    return { parts: parts, models: models, hogis: hogis };
  }
  function isDone(r) { return !!(r && r.done === true); }
  /* 파일마다 식별 결과와, 호기 단위 검사 기록(unit)을 만듭니다.
     src: 'content' = 검사표 내용(글자 층 · AI · 사람이 검사표를 보고 적음), 'filename' = 파일 이름 힌트(확인 필요) */
  function buildUnits(files, readings, known) {
    readings = readings || {};
    var units = [], ids = [];
    (files || []).forEach(function (f) {
      var rd = readings[f.id] || null, hint = hintFromName(f.name, known);
      var meta = {}, src = {};
      META_IDS.forEach(function (k) {
        var v = rd && rd.meta ? str(rd.meta[k]) : '';
        if (v) { meta[k] = v; src[k] = 'content'; }
        else if (hint[k]) { meta[k] = hint[k]; src[k] = 'filename'; }
      });
      var hg = rd && Array.isArray(rd.hogis) ? rd.hogis.filter(function (x) { return x && str(x.no); }) : [];
      var hogiSrc = hg.length ? 'content' : '';
      if (!hg.length && hint.hogi) { hg = [{ no: hint.hogi, values: {} }]; hogiSrc = 'filename'; }
      var idKey = meta.part ? 'part' : 'model';
      var status = !(meta.part || meta.model) || !hg.length ? 'unknown'
        : (src[idKey] === 'filename' || hogiSrc === 'filename') ? 'hint' : 'ok';
      var missing = [];
      if (!(meta.part || meta.model)) missing.push('품번 · 모델');
      if (!hg.length) missing.push('호기');
      var info = { file: f, reading: rd, meta: meta, src: src, hogiSrc: hogiSrc, hogis: hg.map(function (x) { return str(x.no); }), status: status, missing: missing, done: isDone(rd), auto: rd ? rd.auto || '' : '' };
      ids.push(info);
      hg.forEach(function (x, i) {
        units.push({ id: f.id + '|' + i, fileId: f.id, file: f, hogi: str(x.no).replace(/^#/, ''), meta: meta, idStatus: status,
          items: rd && Array.isArray(rd.items) ? rd.items : [], values: x.values || {}, problems: rd && rd.problems || {},
          done: isDone(rd), by: rd ? rd.by || '' : '', at: rd ? rd.at || '' : '' });
      });
    });
    return { units: units, ids: ids };
  }

  // ── 호기 판정 ─────────────────────────────────────────────
  /* 항목 규격 — ① 스펙 덮어쓰기(품번 + 항목 이름 또는 No) ② 검사표에 적힌 규격 글자 ③ 육안이면 OK/NG */
  function resolveSpec(item, part, overrides) {
    var kp = key(part), o = null;
    (overrides || []).some(function (x) {
      if (!x || key(x.part) !== kp) return false;
      var ki = key(x.item);
      if (ki && (ki === key(item.label) || ki === key(item.no) || ki === 'no' + key(item.no))) { o = x; return true; }
      return false;
    });
    if (o) return { kind: o.kind === 'okng' ? 'okng' : 'num', lower: o.lower, upper: o.upper, unit: o.unit || '', src: 'override' };
    if (item.kind === 'okng') return { kind: 'okng', lower: null, upper: null, unit: '', src: 'sheet' };
    var ps = parseSpecString(item.label);
    return { kind: 'num', lower: ps.lower, upper: ps.upper, unit: ps.unit, src: ps.ok ? 'sheet' : 'none' };
  }
  var VERDICT_LABEL = { pass: '합격', fail: '불합격', hold: '보류', wait: '판독 대기', none: '검사표 없음' };
  /* 호기 하나 판정 — 한 칸이라도 벗어나면 불합격(10장 ④). 판독 끝나지 않았으면 'wait'.
     → { verdict, cells:[{key,no,sub,label,spec,specSrc,raw,status,msg,near,side,value}], fails, blanks, unreads, checks, problems:[{no,text}] } */
  function judgeUnit(u, overrides, settings) {
    var S = cleanSettings(settings);
    var items = (u.items || []).map(cleanItem);
    var cells = itemCells(items).map(function (c) {
      var sp = resolveSpec(c.item, u.meta && u.meta.part, overrides);
      var raw = lookupValue(u.values || {}, c.key);
      var j = judgeItem(sp, raw, S);
      j.key = c.key; j.no = c.item.no; j.sub = c.sub; j.label = c.item.label; j.spec = specText(sp); j.specSrc = sp.src;
      return j;
    });
    var problems = Object.keys(u.problems || {}).filter(function (k) { return str(u.problems[k]); }).map(function (k) { return { no: k, text: str(u.problems[k]) }; });
    var res = { verdict: 'wait', cells: cells, fails: [], blanks: [], unreads: [], checks: [], problems: problems, msg: '' };
    res.fails = cells.filter(function (x) { return x.status === 'fail'; });
    res.blanks = cells.filter(function (x) { return x.status === 'blank'; });
    res.unreads = cells.filter(function (x) { return x.status === 'unread' || x.status === 'nospec'; });
    res.checks = cells.filter(function (x) { return x.check && x.status === 'pass'; });
    if (!u.done) return res;
    if (!cells.length) { res.verdict = 'hold'; res.msg = '검사 항목이 없습니다.'; return res; }
    if (res.fails.length) res.verdict = 'fail';                                           // 한 칸이라도 벗어나면 불합격(빈 칸이 함께 있어도)
    else if (res.unreads.length) res.verdict = 'hold';                                    // 못 읽은 칸 · 규격 없음 → 사람이 확인
    else if (res.blanks.length && (S.blankAs === 'hold' || res.blanks.length === cells.length)) res.verdict = 'hold';
    else res.verdict = 'pass';
    return res;
  }
  function lookupValue(values, k) {
    if (Object.prototype.hasOwnProperty.call(values, k)) return values[k];
    var kk = key(k);
    for (var x in values) if (key(x) === kk) return values[x];
    return '';
  }

  // ── 출하일정 ↔ 검사 기록 ──────────────────────────────────
  /* ships: parseShip 결과 rows, files · readings: 저장 데이터, today: 'YYYY-MM-DD'
     → { ids, units(판정 포함), rows(출하별), extra(출하일정에 없는 검사), counts, fails } */
  function analyze(ships, files, readings, overrides, settings, today) {
    var known = knownIds(ships, readings);
    var b = buildUnits(files, readings, known);
    b.units.forEach(function (u) { u.judge = judgeUnit(u, overrides, settings); });
    var idx = {};
    function put(k, u) { (idx[k] = idx[k] || []).push(u); }
    b.units.forEach(function (u) {
      if (!u.hogi) return;
      var kh = key(u.hogi);
      if (u.meta.part) put('p:' + key(u.meta.part) + '|' + kh, u);
      splitModels(u.meta.model).forEach(function (m) { put('m:' + key(m) + '|' + kh, u); });
    });
    var matched = {};
    var rows = (ships || []).map(function (s) {
      var kh = key(s.hogi), how = '', cands = [];
      if (s.part) { cands = idx['p:' + key(s.part) + '|' + kh] || []; how = 'part'; }
      if (!cands.length && s.model) {
        splitModels(s.model).forEach(function (m) { (idx['m:' + key(m) + '|' + kh] || []).forEach(function (u) { if (cands.indexOf(u) < 0) cands.push(u); }); });
        how = 'model';
      }
      var row = { ship: s, unit: null, units: cands, how: cands.length ? how : '', status: 'none', notes: [], days: daysBetween(today, s.date) };
      if (!cands.length) return row;
      var done = cands.filter(function (u) { return u.done; }).sort(function (a, c) { return str(a.at) < str(c.at) ? -1 : 1; });
      row.unit = done.length ? done[done.length - 1] : cands[0];
      row.status = row.unit.judge.verdict;
      cands.forEach(function (u) { matched[u.id] = true; });
      if (cands.length > 1) row.notes.push('같은 호기 검사표 ' + cands.length + '개(가장 나중에 판독한 것으로 판정)');
      if (how === 'model') row.notes.push(s.part ? '품번으로는 짝이 없어 모델+호기로 짝지음' + (row.unit.meta.part ? '(검사표 품번 ' + row.unit.meta.part + ')' : '') : '모델+호기로 짝지음');
      if (row.unit.idStatus === 'hint') row.notes.push('파일 이름으로만 식별 — 검사표 내용으로 확인 필요');
      return row;
    });
    var extra = b.units.filter(function (u) { return !matched[u.id]; });
    var counts = { ships: rows.length, none: 0, wait: 0, hold: 0, fail: 0, pass: 0, files: (files || []).length, units: b.units.length, extra: extra.length, unknown: 0, hint: 0, unitFail: 0 };
    rows.forEach(function (r) { counts[r.status]++; });
    b.ids.forEach(function (i) { if (i.status === 'unknown') counts.unknown++; if (i.status === 'hint') counts.hint++; });
    b.units.forEach(function (u) { if (u.judge.verdict === 'fail') counts.unitFail++; });
    counts.undecided = counts.wait + counts.hold;
    var shipOf = {};
    rows.forEach(function (r) { if (r.unit) shipOf[r.unit.id] = r.ship; });
    var fails = [];
    b.units.forEach(function (u) {
      if (u.judge.verdict !== 'fail') return;
      var s = shipOf[u.id];
      u.judge.fails.forEach(function (c) {
        fails.push({ shipDate: s ? s.date : '', days: s ? daysBetween(today, s.date) : null, model: u.meta.model || '', part: u.meta.part || '', name: u.meta.name || '', hogi: u.hogi,
          no: c.no, sub: c.sub, label: c.label, spec: c.spec, raw: c.raw, msg: c.msg, sheetDate: u.meta.date || '', file: u.file.name, problem: str((u.problems || {})[c.no]) });
      });
    });
    fails.sort(function (a, c) { return (a.shipDate || '9') < (c.shipDate || '9') ? -1 : (a.shipDate || '9') > (c.shipDate || '9') ? 1 : 0; });
    return { ids: b.ids, units: b.units, rows: rows, extra: extra, counts: counts, fails: fails, today: today };
  }
  /* 출하일 순으로 한 상태만 */
  function shipList(an, statuses) {
    return an.rows.filter(function (r) { return statuses.indexOf(r.status) >= 0; }).sort(function (a, b) { return (a.ship.date || '9') < (b.ship.date || '9') ? -1 : (a.ship.date || '9') > (b.ship.date || '9') ? 1 : 0; });
  }
  /* 품번 · 항목별 */
  function byItem(an) {
    var map = {};
    an.units.forEach(function (u) {
      if (!u.done) return;
      u.judge.cells.forEach(function (c) {
        var k = (u.meta.part || u.meta.model) + '\u0001' + c.key;
        var o = map[k] || (map[k] = { part: u.meta.part || u.meta.model || '', key: c.key, label: c.label, sub: c.sub, spec: c.spec, n: 0, fail: 0, low: 0, high: 0, near: 0, blank: 0 });
        if (c.status === 'pass' || c.status === 'fail') o.n++;
        if (c.status === 'fail') { o.fail++; if (c.side === 'low') o.low++; if (c.side === 'high') o.high++; }
        if (c.near) o.near++;
        if (c.status === 'blank') o.blank++;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.fail - a.fail || b.near - a.near || (a.part + a.key < b.part + b.key ? -1 : 1); });
  }
  function byPart(an) {
    var map = {};
    an.units.forEach(function (u) {
      var p = u.meta.part || u.meta.model || '(식별 안 됨)';
      var o = map[p] || (map[p] = { part: p, model: u.meta.model || '', units: 0, judged: 0, fail: 0, hold: 0, wait: 0 });
      o.units++;
      var v = u.judge.verdict;
      if (v === 'pass' || v === 'fail') o.judged++;
      if (v === 'fail') o.fail++; if (v === 'hold') o.hold++; if (v === 'wait') o.wait++;
    });
    return Object.keys(map).sort().map(function (k) { var o = map[k]; o.failRate = o.judged ? o.fail / o.judged : null; return o; });
  }

  // ── AI 판독 프롬프트 · 답 읽기 ────────────────────────────
  /* 검사표 그림 한 장과 함께 보낼 프롬프트. 회사 정보는 넣지 않고, 아는 항목(No · 규격 · 구분)만 넣습니다.
     항목을 아직 모르면(처음 보는 양식) 항목 목록도 함께 읽어 달라고 합니다. */
  function buildSheetPrompt(items, opts) {
    opts = opts || {};
    var its = (items || []).map(cleanItem);
    var tmpl = {};
    itemCells(its).forEach(function (c) { tmpl[c.key] = c.item.kind === 'okng' ? 'OK' : ''; });
    var L = [];
    L.push('첨부한 그림은 현장에서 손으로 적은 「자주 검사 CHECK SHEET」 한 장이야.');
    L.push('오른쪽 표는 검사 항목이 줄, 호기(제품 번호)가 열이야. 호기 번호는 표 맨 위 「호기수」 줄에 손으로 적혀 있어.');
    L.push('적힌 값을 「적힌 그대로」 읽어 줘. 계산하거나 고치거나 합격 · 불합격을 판단하지 마.');
    L.push('');
    if (its.length) {
      L.push('[검사 항목] (칸 이름 = No + 구분)');
      its.forEach(function (it) { L.push('- ' + it.no + '. ' + (it.label || '(이름 없음)') + (it.tool ? ' · ' + it.tool : '') + (it.subs.length ? ' — 구분 ' + it.subs.join(', ') + ' 줄이 따로 있음' : '') + (it.kind === 'okng' ? ' — 육안(OK 또는 NG)' : '')); });
    } else {
      L.push('[검사 항목] 아직 모르는 양식이야. 표의 No · 검사 항목(규격 글자 그대로, 예: 420±1) · 측정기 · 구분(LH/RH 같은 작은 줄)도 "항목" 에 적어 줘.');
    }
    L.push('');
    L.push('[지켜 줄 것]');
    L.push('- 위쪽 머리 칸(모델명 · 품번 · 품명 · 관리 번호 · 작성일 · 제작 공정명)도 읽어 줘. 모델명에 동그라미 친 것이 있으면 그것만.');
    L.push('- 호기 열마다 하나씩, 호기 번호가 적힌 열만 적어 줘(빈 열은 빼).');
    L.push('- 칸이 비어 있으면 "", 체크 표시(✓ · V)만 있으면 "✓", 글씨를 알아볼 수 없으면 "?" 로. 추측해서 채우지 마.');
    L.push('- 「문제점(조치사항)」 칸에 적힌 글이 있으면 항목 No 별로 적어 줘.');
    L.push('- 확신이 낮은 칸은 "확신낮음" 목록에 칸 이름(예: "2 LH")을 넣어 줘.');
    L.push('- 검사자 · 결재 칸의 이름 · 서명은 읽지도 적지도 마.');
    L.push('');
    L.push('[답 형식] 아래 JSON 하나만, 다른 설명 없이 답해 줘.');
    var ans = { 모델명: '', 품번: '', 품명: '', 관리번호: '', 작성일: 'YYYY-MM-DD', 제작공정명: '' };
    if (!its.length) ans['항목'] = [{ No: '1', 검사항목: '', 측정기: '', 구분: ['LH', 'RH'] }];
    ans['호기'] = [{ 호기: '', 값: its.length ? tmpl : { '1': '', '2 LH': '', '2 RH': '' } }];
    ans['문제점'] = {};
    ans['확신낮음'] = [];
    L.push(JSON.stringify(ans, null, 2));
    return L.join('\n');
  }
  var AI_META = { 모델명: 'model', 모델: 'model', model: 'model', 품번: 'part', part: 'part', 품명: 'name', name: 'name', 관리번호: 'mgmt', 작성일: 'date', date: 'date', 제작공정명: 'process', 공정명: 'process' };
  /* AI 답 → { ok, meta, hogis:[{no, values}], problems, items(답에 항목이 있으면), lowConf, unknown, error } */
  function parseSheetAi(text, items) {
    var out = { ok: false, meta: {}, hogis: [], problems: {}, items: null, lowConf: [], unknown: [], error: '' };
    var t = str(text).replace(/```(?:json)?/gi, '');
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) { out.error = '답에서 JSON({ … })을 찾지 못했습니다.'; return out; }
    var j;
    try { j = JSON.parse(t.slice(a, b + 1)); }
    catch (e) {
      try { j = JSON.parse(t.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); }
      catch (e2) { out.error = 'JSON 으로 읽지 못했습니다: ' + e.message; return out; }
    }
    Object.keys(j).forEach(function (k) { var f = AI_META[key(k)] || AI_META[k]; if (f && str(j[k])) out.meta[f] = f === 'date' ? (toDate(j[k]) || str(j[k])) : str(j[k]); });
    var its = (items || []).map(cleanItem);
    if (Array.isArray(j['항목'] || j.items)) {
      out.items = (j['항목'] || j.items).map(function (x, i) {
        return cleanItem({ no: x.No || x.no || x['번호'], label: x['검사항목'] || x['검사 항목'] || x.label, tool: x['측정기'] || x.tool, subs: x['구분'] || x.subs }, i);
      }).filter(function (x) { return x.label || x.subs.length; });
      if (!its.length) its = out.items;
    }
    var known = {};
    itemCells(its).forEach(function (c) { known[key(c.key)] = c.key; });
    var hg = j['호기'] || j.hogis || [];
    if (!Array.isArray(hg)) hg = [hg];
    hg.forEach(function (h) {
      if (!h || typeof h !== 'object') return;
      var no = str(h['호기'] || h.no || h['번호']).replace(/^#/, '');
      var vals = {}, src = h['값'] || h.values || {};
      Object.keys(src).forEach(function (k) {
        var v = src[k]; v = v == null || typeof v === 'object' ? '' : String(v).trim();
        var ck = known[key(k)];
        if (ck) vals[ck] = v; else if (out.unknown.indexOf(k) < 0) out.unknown.push(k);
      });
      if (no || Object.keys(vals).some(function (k) { return vals[k]; })) out.hogis.push({ no: no, values: vals });
    });
    var pr = j['문제점'] || j.problems || {};
    if (pr && typeof pr === 'object') Object.keys(pr).forEach(function (k) { if (str(pr[k])) out.problems[str(k)] = str(pr[k]); });
    var lc = j['확신낮음'] || j.lowConf || [];
    if (Array.isArray(lc)) out.lowConf = lc.map(function (k) { return known[key(k)] || str(k); }).filter(Boolean);
    out.ok = out.hogis.length > 0 || Object.keys(out.meta).length > 0;
    if (!out.ok) out.error = '호기 값도 머리 칸도 읽지 못했습니다. 답 형식을 확인해 주세요.';
    return out;
  }

  // ── 요약 프롬프트(품번 · 모델 가림) ───────────────────────
  function aliasMap(names, prefix) {
    var m = {}, i = 0;
    names.forEach(function (p) { if (p && !m[p]) m[p] = (prefix || '제품') + (++i); });
    return m;
  }
  function buildSummaryPrompt(an, opts) {
    opts = opts || {};
    var mask = opts.mask !== false;
    var parts = byPart(an), items = byItem(an).filter(function (x) { return x.fail || x.near; }).slice(0, 15);
    var models = [];
    an.units.forEach(function (u) { splitModels(u.meta.model).forEach(function (m) { if (models.indexOf(m) < 0) models.push(m); }); });
    (an.rows || []).forEach(function (r) { splitModels(r.ship.model).forEach(function (m) { if (models.indexOf(m) < 0) models.push(m); }); });
    var amap = {};
    if (mask) {
      var pm = aliasMap(parts.map(function (p) { return p.part; }), '제품'), mm = aliasMap(models, '모델');
      Object.keys(mm).forEach(function (k) { if (!pm[k]) amap[k] = mm[k]; });
      Object.keys(pm).forEach(function (k) { amap[k] = pm[k]; });
    }
    function P(p) { return mask ? (amap[p] || p) : p; }
    var c = an.counts, L = [];
    L.push('너는 제조 품질 담당자를 돕는 보조야. 아래는 수기 검사표(자주 검사 CHECK SHEET)를 옮겨 판정하고 출하일정과 맞춘 결과의 「계산된 사실」이야. 사실 밖의 숫자를 만들지 말고, 원인은 「추정」이라고 표시해 줘.');
    L.push('');
    L.push('[출하 대조] (기준일 ' + (an.today || '') + ')');
    L.push('- 출하 예정 ' + c.ships + '대: 합격 ' + c.pass + ' · 불합격 ' + c.fail + ' · 미판정 ' + c.undecided + '(판독 대기 ' + c.wait + ' · 보류 ' + c.hold + ') · 검사표 없음 ' + c.none);
    L.push('- 검사표 PDF ' + c.files + '개 · 호기 기록 ' + c.units + '개 · 출하일정에 없는 검사 ' + c.extra + '개 · 식별 필요 파일 ' + (c.unknown + c.hint) + '개');
    var soon = shipList(an, ['none', 'fail', 'wait', 'hold']).filter(function (r) { return r.days != null && r.days >= 0 && r.days <= 7; });
    if (soon.length) {
      L.push('');
      L.push('[7일 안에 출하인데 합격이 아닌 것]');
      soon.forEach(function (r) { L.push('- ' + r.ship.date + ' (' + dday(r.days) + ') ' + P(r.ship.part || r.ship.model) + ' 호기 ' + r.ship.hogi + ': ' + VERDICT_LABEL[r.status]); });
    }
    L.push('');
    L.push('[품번별]');
    parts.forEach(function (p) { L.push('- ' + P(p.part) + ': 호기 ' + p.units + ', 판정 ' + p.judged + ', 불합격 ' + p.fail + ' (' + pctText(p.failRate) + '), 보류 ' + p.hold + ', 판독 대기 ' + p.wait); });
    if (items.length) {
      L.push('');
      L.push('[불합격 · 경계 근처가 많은 칸]');
      items.forEach(function (x) { L.push('- ' + P(x.part) + ' / No ' + x.key + ' ' + x.label + ' (기준 ' + x.spec + '): 판정 ' + x.n + ' 중 불합격 ' + x.fail + '(하한 밑 ' + x.low + ', 상한 위 ' + x.high + '), 경계 근처 ' + x.near + ', 빈 칸 ' + x.blank); });
    }
    L.push('');
    L.push('[부탁]');
    L.push('1. 출하 전 검사 현황을 보고용으로 3~5줄로 요약해 줘.');
    L.push('2. 출하가 가까운데 검사표가 없거나 미판정인 것을 먼저 처리하도록 순서를 제안해 줘.');
    L.push('3. 불합격이 몰린 품번 · 칸과 방향(하한 밑/상한 위)을 짚고, 현장에서 먼저 확인할 것을 「추정」으로 3가지 이내 제안해 줘.');
    if (mask) L.push('(품번 · 모델은 「제품1」 「모델1」 같은 별칭으로 가렸어. 답에서도 별칭을 그대로 써 줘.)');
    return { text: L.join('\n'), map: amap };
  }
  /* 별칭 → 원래 이름 (긴 별칭부터 — 「제품10」 이 「제품1」 로 먼저 바뀌지 않게) */
  function unmask(text, map) {
    var t = String(text || '');
    var pairs = Object.keys(map || {}).map(function (k) { return [map[k], k]; }).sort(function (a, b) { return b[0].length - a[0].length; });
    pairs.forEach(function (p) { t = t.split(p[0]).join(p[1]); });
    return t;
  }

  // ── 저장 데이터 ──────────────────────────────────────────
  function emptyDb() { return { v: 2, cleared: false, ships: [], shipFile: '', files: [], readings: {}, overrides: [], overrideFile: '', settings: cleanSettings({}), aiNote: '', masks: [], sample: false, refDate: '' }; }
  /* 저장 데이터 되살리기. 1단계(v1 — 로트 · 파일 이름 규칙) 자료는 형식이 달라 버리고 legacy 표시만 남깁니다. */
  function restoreDb(o) {
    var d = emptyDb();
    if (!o || typeof o !== 'object') return d;
    if (o.v !== 2) { d.legacy = !!(o.plan || o.files); return d; }
    if (Array.isArray(o.ships)) d.ships = o.ships.filter(function (s) { return s && (s.part || s.model) && s.hogi; });
    if (Array.isArray(o.files)) d.files = o.files.filter(function (f) { return f && f.id && f.name; });
    if (o.readings && typeof o.readings === 'object') d.readings = o.readings;
    if (Array.isArray(o.overrides)) d.overrides = o.overrides.filter(function (s) { return s && s.part && s.item; });
    if (Array.isArray(o.masks)) d.masks = o.masks.filter(function (m) { return m && isNum(m.x) && isNum(m.y) && isNum(m.w) && isNum(m.h); });
    d.settings = cleanSettings(o.settings);
    d.cleared = !!o.cleared;
    d.shipFile = str(o.shipFile); d.overrideFile = str(o.overrideFile); d.aiNote = str(o.aiNote); d.sample = !!o.sample;
    d.refDate = toDate(o.refDate) || '';
    return d;
  }
  function fileId(name, size) { return key(name) + ':' + (size || 0); }

  return {
    VERSION: VERSION,
    str: str, key: key, round: round, fmtNum: fmtNum, pctText: pctText, halfWidth: halfWidth, toDate: toDate, daysBetween: daysBetween, dday: dday,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS, cleanSettings: cleanSettings,
    SHIP_FIELDS: SHIP_FIELDS, SPEC_FIELDS: SPEC_FIELDS, detectColumns: detectColumns, parseShip: parseShip, splitHogi: splitHogi, splitModels: splitModels,
    parseSpec: parseSpec, cleanSpec: cleanSpec, specText: specText, parseSpecString: parseSpecString,
    parseNumber: parseNumber, unitInfo: unitInfo, judgeItem: judgeItem,
    TEMPLATE: TEMPLATE, META_IDS: META_IDS, cellKey: cellKey, itemCells: itemCells, cleanItem: cleanItem,
    normTextItems: normTextItems, parseSheetText: parseSheetText,
    hintFromName: hintFromName, knownIds: knownIds, buildUnits: buildUnits, isDone: isDone,
    resolveSpec: resolveSpec, judgeUnit: judgeUnit, VERDICT_LABEL: VERDICT_LABEL,
    analyze: analyze, shipList: shipList, byItem: byItem, byPart: byPart,
    buildSheetPrompt: buildSheetPrompt, parseSheetAi: parseSheetAi, buildSummaryPrompt: buildSummaryPrompt, aliasMap: aliasMap, unmask: unmask,
    emptyDb: emptyDb, restoreDb: restoreDb, fileId: fileId
  };
});
