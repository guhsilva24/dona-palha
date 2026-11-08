/**
 * Formatadores e utilitários de data e texto
 */

import {
  MONTH_NAMES_SHORT,
  MONTH_NAMES_LONG,
  DAY_NAMES_SHORT,
  DAY_NAMES_LONG
} from './constants.js';

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function today() {
  return toDateStr(new Date());
}

export function addDays(dateStr, n) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2] + n);
  return toDateStr(d);
}

export function diffDays(dateStrA, dateStrB) {
  const a = dateStrA.split('-').map(Number);
  const b = dateStrB.split('-').map(Number);
  const utcA = Date.UTC(a[0], a[1] - 1, a[2]);
  const utcB = Date.UTC(b[0], b[1] - 1, b[2]);
  return Math.round((utcB - utcA) / 864e5);
}

export function parseDateParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate(), w: now.getDay() };
  }
  const parts = dateStr.split('-').map(Number);
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return {
    y: parts[0],
    m: parts[1],
    d: parts[2],
    w: dateObj.getDay()
  };
}

export function dayLabel(dateStr) {
  const t = today();
  if (dateStr === t) return 'Hoje';
  if (dateStr === addDays(t, -1)) return 'Ontem';
  const p = parseDateParts(dateStr);
  return `${DAY_NAMES_SHORT[p.w]}, ${pad2(p.d)} ${MONTH_NAMES_SHORT[p.m - 1]}`;
}

export function shortDate(dateStr) {
  if (!dateStr) return '—';
  const p = parseDateParts(dateStr);
  return `${pad2(p.d)}/${pad2(p.m)}`;
}

export function longToday() {
  const p = parseDateParts(today());
  return `${DAY_NAMES_LONG[p.w]}, ${p.d} de ${MONTH_NAMES_LONG[p.m - 1]}`;
}

export function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function shiftMonth(yearMonthStr, delta) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

export function num(v) {
  const s = String(v == null ? '' : v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  let normalized = s;
  if (s.includes(',')) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function unidades(n) {
  const val = parseInt(n, 10) || 0;
  return `${val} ${val === 1 ? 'unidade' : 'unidades'}`;
}

export function getDueInfo(dateStr) {
  if (!dateStr) return { c: '', t: 'Sem vencimento' };
  const d = diffDays(today(), dateStr);
  if (d < 0) return { c: 'bad', t: `Atrasado ${-d} ${-d === 1 ? 'dia' : 'dias'}` };
  if (d === 0) return { c: 'warn', t: 'Vence hoje' };
  if (d === 1) return { c: '', t: 'Amanhã' };
  return { c: '', t: `Em ${d} dias` };
}

