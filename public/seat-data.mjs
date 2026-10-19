import { normalizeSeat } from './seat-layout.mjs';

/** Shared CSV lookup parsing; supports the existing roster converter output. */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Incomplete roster');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map(h => h.replace(/^\uFEFF/, '').trim());
  if (!headers.includes('phone_hash') || !headers.includes('seat')) throw new Error('Invalid roster');
  return rows.map(values => Object.fromEntries(headers.map((header, i) => [header, (values[i] || '').trim()])))
    .filter(record => record.seat && /^[a-f0-9]{64}$/i.test(record.phone_hash));
}

export function normalizePhone(value) {
  let number = value.replace(/[\s()·.-]/g, '');
  if (number.startsWith('+82')) number = '0' + number.slice(3).replace(/^0/, '');
  return /^0\d{9,10}$/.test(number) ? number : null;
}

export function formatPhoneInput(value) {
  let digits = value.replace(/\D/g, '');
  if (/^\s*\+82/.test(value)) digits = '0' + digits.slice(2).replace(/^0/, '');
  digits = digits.slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean).join(' · ');
}

export function seatZone(seat) {
  const value = normalizeSeat(seat);
  if (!value || value === 'VIP') return null;
  return /^V[12]$/.test(value) ? value : value[0];
}

export function summarizeSeats(rows) {
  const seats = [...new Set(rows.map(row => {
    const value = normalizeSeat(row.seat);
    // V1 and V2 form one first-come VIP area, including older zone-specific data.
    if (String(row.vip || '').toLowerCase() === 'vip' || /^V[12]$/.test(value)) return 'VIP';
    return value || row.seat.trim();
  }).filter(Boolean))];
  const firstCome = seats.includes('VIP') ? ['V1', 'V2'] : [];
  const assigned = seats.filter(seat => normalizeSeat(seat) && !/^V/.test(seat));
  const zones = [...new Set([...assigned.map(seatZone), ...firstCome])];
  return {
    seats, zones, firstCome, assigned,
  };
}
