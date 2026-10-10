import { getLookupKey } from './phone-hash.mjs';
import { parseCSV, normalizePhone, summarizeSeats, formatPhoneInput } from './seat-data.mjs';
import { seatLayout, labelSeat } from './seat-layout.mjs';

const pages = [...document.querySelectorAll('[data-page]')];
const ticketDialog = document.querySelector('#ticket-dialog');
const menuDialog = document.querySelector('#menu-dialog');
const form = document.querySelector('#seat-form');
const phone = document.querySelector('#phone');
const message = document.querySelector('#lookup-message');
const submit = document.querySelector('#lookup-button');
const submitText = submit.querySelector('p');
const summary = document.querySelector('#seat-summary');
const pageSummary = summary.cloneNode(true);
pageSummary.id = 'page-seat-summary';
summary.before(pageSummary);
const seatMap = document.querySelector('#seat-map');
const mapWrapper = seatMap.parentElement;
for (const [zone, rows] of Object.entries(seatLayout)) {
  const chairs = seatMap.querySelectorAll(`[data-zone="${zone}"] [data-name="Rectangle"]`);
  rows.flat().forEach((id, index) => {
    chairs[index].dataset.seat = id;
    chairs[index].setAttribute('role', 'img');
    chairs[index].setAttribute('aria-label', id);
    chairs[index].title = id;
  });
}
// Keep lookup results inside the ticket, without changing the page or URL.
const resultPanel = document.createElement('section');
resultPanel.id = 'ticket-result';
resultPanel.className = 'ticket-result';
resultPanel.hidden = true;
const resultHeader = document.createElement('div');
resultHeader.className = 'ticket-result-header';
const resultClose = form.querySelector('[data-close]').cloneNode(true);
resultClose.setAttribute('aria-label', '좌석 확인 닫기');
resultClose.removeAttribute('data-node-id');
resultHeader.append(summary, resultClose);
const resultMap = seatMap.cloneNode(true);
resultMap.id = 'ticket-seat-map';
const resultMapWrapper = document.createElement('div');
resultMapWrapper.className = 'seat-map-wrap';
resultMapWrapper.append(resultMap);
resultPanel.append(resultHeader, resultMapWrapper);
ticketDialog.append(resultPanel);
let lookupVersion = 0;
let dialogOpener = null;
let currentPage = 'home';

function goTo(page, { focus = true, history = true } = {}) {
  if (!pages.some(el => el.id === page)) page = 'home';
  for (const dialog of [ticketDialog, menuDialog]) if (dialog.open) dialog.close();
  for (const section of pages) section.hidden = section.id !== page;
  currentPage = page;
  document.querySelectorAll('#menu-dialog [data-go]').forEach(button => {
    if (button.dataset.go === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const section = document.getElementById(page);
  const scrollArea = section.querySelector('.page-content');
  if (scrollArea) scrollArea.scrollTop = 0;
  if (history && location.hash !== '#' + page) window.history.pushState(null, '', '#' + page);
  if (focus) section.querySelector('h1')?.focus({ preventScroll: true });
  if (page === 'seats') requestAnimationFrame(resizeSeatMap);
}

function openTicket(opener) {
  if (menuDialog.open) menuDialog.close();
  dialogOpener = opener;
  lookupVersion++;
  form.reset();
  form.hidden = false;
  resultPanel.hidden = true;
  clearSeatResult();
  ticketDialog.setAttribute('aria-labelledby', 'ticket-title');
  phone.removeAttribute('aria-invalid');
  message.textContent = '초대장에 등록한 전화번호를 입력해 주세요.';
  delete message.dataset.state;
  submit.disabled = false;
  submitText.textContent = '좌석 확인하기';
  ticketDialog.showModal();
  phone.focus({ preventScroll: true });
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.hasAttribute('data-go')) goTo(target.dataset.go);
  else if (target.hasAttribute('data-ticket')) openTicket(target);
  else if (target.hasAttribute('data-menu')) {
    dialogOpener = target;
    menuDialog.showModal();
    menuDialog.querySelector('[data-close]').focus({ preventScroll: true });
  } else if (target.hasAttribute('data-close')) target.closest('dialog').close();
});

for (const dialog of [ticketDialog, menuDialog]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    lookupVersion++;
    if (dialog === ticketDialog) phone.value = '';
    if (dialogOpener?.isConnected && dialogOpener.getClientRects().length) dialogOpener.focus({ preventScroll: true });
  });
}

function clearSeatResult() {
  summary.replaceChildren();
  summary.hidden = true;
  resultMap.querySelectorAll('.seat-active').forEach(chair => chair.classList.remove('seat-active'));
  resultMap.querySelectorAll('[data-zone]').forEach(zone => zone.classList.remove('highlight', 'zone-first-come'));
}

function showSeatResult(matches) {
  const result = summarizeSeats(matches);
  clearSeatResult();
  const names = [...new Set(matches.map(row => String(row.name || '').trim()).filter(Boolean))];
  if (names.length) {
    const name = document.createElement('p');
    name.className = 'guest-name';
    name.textContent = names.join(' · ');
    summary.append(name);
  }
  const location = document.createElement('p');
  location.className = 'guest-location';
  location.textContent = result.seats.map(seat => seat === 'VIP' ? 'VIP · V1 · V2 · 선착순' : /^V[12]$/.test(seat) ? `VIP · ${seat} · 선착순` : labelSeat(seat)).join(' / ');
  summary.append(location);
  summary.hidden = false;
  // Commit both views only after a successful lookup. Editing or cancelling keeps
  // the last confirmed result on page 06 until another number is found.
  pageSummary.replaceChildren(...[...summary.childNodes].map(node => node.cloneNode(true)));
  pageSummary.hidden = false;
  for (const map of [seatMap, resultMap]) {
    for (const element of map.querySelectorAll('[data-zone]')) {
      element.classList.toggle('highlight', result.firstCome.includes(element.dataset.zone));
      element.classList.toggle('zone-first-come', result.firstCome.includes(element.dataset.zone));
    }
    for (const chair of map.querySelectorAll('[data-seat]')) {
      chair.classList.toggle('seat-active', result.assigned.includes(chair.dataset.seat));
    }
  }
  phone.value = '';
  phone.blur();
  form.hidden = true;
  resultPanel.hidden = false;
  ticketDialog.setAttribute('aria-labelledby', 'seat-summary');
  ticketDialog.scrollTop = 0;
  resizeSeatMap();
  resultClose.focus({ preventScroll: true });
}

phone.addEventListener('beforeinput', event => {
  const backward = event.inputType === 'deleteContentBackward';
  const forward = event.inputType === 'deleteContentForward';
  if ((!backward && !forward) || phone.selectionStart !== phone.selectionEnd) return;
  const caret = phone.selectionStart;
  let index = backward ? caret - 1 : caret;
  if (index < 0 || index >= phone.value.length || /\d/.test(phone.value[index])) return;
  while (index >= 0 && index < phone.value.length && !/\d/.test(phone.value[index])) index += backward ? -1 : 1;
  if (index < 0 || index >= phone.value.length) return;
  event.preventDefault();
  phone.setRangeText('', backward ? index : caret, backward ? caret : index + 1, 'start');
  phone.dispatchEvent(new Event('input', { bubbles: true }));
});

phone.addEventListener('input', event => {
  if (event.isComposing) return;
  const raw = phone.value;
  const caret = phone.selectionStart ?? raw.length;
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
  const international = /^\s*\+82/.test(raw);
  phone.value = formatPhoneInput(raw);
  let nextCaret = phone.value.length;
  if (caret < raw.length && !international) {
    nextCaret = 0;
    for (let count = 0; nextCaret < phone.value.length && count < digitsBefore; nextCaret++) {
      if (/\d/.test(phone.value[nextCaret])) count++;
    }
  }
  phone.setSelectionRange(nextCaret, nextCaret);
  lookupVersion++;
  submit.disabled = false;
  submitText.textContent = '좌석 확인하기';
  phone.removeAttribute('aria-invalid');
  delete message.dataset.state;
  message.textContent = '초대장에 등록한 전화번호를 입력해 주세요.';
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const version = ++lookupVersion;
  clearSeatResult();
  const value = normalizePhone(phone.value);
  if (!value) {
    message.textContent = '전화번호 10~11자리를 확인해 주세요.';
    message.dataset.state = 'error'; phone.setAttribute('aria-invalid', 'true'); phone.focus(); return;
  }
  submit.disabled = true; submitText.textContent = '확인 중…';
  message.textContent = '초대 좌석을 확인하고 있습니다.'; delete message.dataset.state;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const key = await getLookupKey(value);
    const response = await fetch('./seats.csv', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('roster unavailable');
    const matches = parseCSV(await response.text()).filter(row => row.phone_hash.toLowerCase() === key);
    if (version !== lookupVersion || !ticketDialog.open) return;
    if (!matches.length) {
      message.textContent = '등록된 좌석이 없습니다. 초대받은 번호를 확인하거나 현장 스태프에게 문의해 주세요.';
      message.dataset.state = 'error'; return;
    }
    showSeatResult(matches);
  } catch {
    if (version === lookupVersion) {
      message.textContent = '명단을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
      message.dataset.state = 'error';
    }
  } finally {
    clearTimeout(timer);
    if (version === lookupVersion) { submit.disabled = false; submitText.textContent = '좌석 확인하기'; }
  }
});

function resizeSeatMap() {
  for (const map of [seatMap, resultMap]) {
    const wrapper = map.parentElement;
    if (!wrapper.clientWidth) continue;
    const scale = Math.min(1, wrapper.clientWidth / 342);
    map.style.setProperty('--map-scale', scale);
    wrapper.style.height = map.offsetHeight * scale + 'px';
  }
}
const mapObserver = new ResizeObserver(resizeSeatMap);
mapObserver.observe(mapWrapper);
mapObserver.observe(resultMapWrapper);
window.addEventListener('popstate', () => goTo(location.hash.slice(1), { history: false }));
window.addEventListener('hashchange', () => {
  if (location.hash.slice(1) !== currentPage) goTo(location.hash.slice(1), { history: false });
});
goTo(location.hash.slice(1) || 'home', { focus: false, history: false });
