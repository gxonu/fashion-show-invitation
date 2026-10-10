// 09.30 무대팀 진행상황 보고.pdf, page 17 (top-to-bottom, left-to-right).
// A–C face down toward the stage; D–F face up. Each zone has 3 × 10 chairs.
const front = ['a', 'b', 'c', 'd', 'e'].flatMap(group => [`${group}-1`, `${group}-2`]);
const middle = ['a', 'b', 'c', 'd', 'e'].flatMap(group => [`${group}-3`, `${group}-4`]);
const back = ['f', 'g'].flatMap(group => [1, 2, 3, 4, 5].map(number => `${group}-${number}`));

export const seatLayout = Object.fromEntries([... 'ABCDEF'].map(zone => [zone,
  (zone <= 'C' ? [back, middle, front] : [front, middle, back])
    .map(row => row.map(seat => `${zone}-${seat}`)),
]));

const seatIds = new Set(Object.values(seatLayout).flat(2));

export function normalizeSeat(value) {
  const text = String(value || '').trim();
  if (/^V[12]$/i.test(text) || /^VIP$/i.test(text)) return text.toUpperCase();
  const parts = text.match(/^([A-F])(?:구역)?[\s_-]*([a-g])[\s_-]*([1-5])$/i);
  if (!parts) return null;
  const id = `${parts[1].toUpperCase()}-${parts[2].toLowerCase()}-${parts[3]}`;
  return seatIds.has(id) ? id : null;
}

export function labelSeat(id) {
  return id === 'VIP' ? 'V1 · V2' : id;
}
