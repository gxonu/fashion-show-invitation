const app = document.querySelector(".app");
const modal = document.querySelector("[data-ticket-modal]");
const ticket = document.querySelector(".ticket");
const openTicketButtons = document.querySelectorAll("[data-open-ticket], [data-reset-ticket]");
const openInfoButtons = document.querySelectorAll("[data-open-info]");
const openDirectionsButtons = document.querySelectorAll("[data-open-directions]");
const closeTicketButtons = document.querySelectorAll("[data-close-ticket]");
const unlockTicketButton = document.querySelector("[data-unlock-ticket]");
const confirmEntryButton = document.querySelector("[data-confirm-entry]");
const entryStatus = document.querySelector("[data-entry-status]");
const seatLookupForm = document.querySelector("[data-seat-lookup]");
const seatInput = document.querySelector("[data-seat-input]");
const seatMessage = document.querySelector("[data-seat-message]");
const seatDisplay = document.querySelector("[data-seat-display]");
const guestNameDisplay = document.querySelector("[data-guest-name]");
const vipTitle = document.querySelector("[data-vip-title]");
const folderButtons = document.querySelectorAll("[data-folder-tab]");
const homeButtons = document.querySelectorAll("[data-home]");
const tabs = document.querySelectorAll("[data-tab]");
const ENTRY_OPEN_AT = new Date("2026-08-08T17:00:00+09:00");
let ticketOpenTimer;
let entryGateTimer;
let guestSeats = new Map();
let seatListReady = false;
let seatListLoadFailed = false;
let selectedSeat = "";

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Fallback(message) {
  const bytes = new TextEncoder().encode(message);
  const bitLength = bytes.length * 8;
  const paddedLength = (((bytes.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}

async function getLookupKey(phone) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(phone);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return sha256Fallback(phone);
}

function isEntryOpen() {
  return Date.now() >= ENTRY_OPEN_AT.getTime();
}

function setSeatMessage(message, state = "") {
  if (!seatMessage) {
    return;
  }

  seatMessage.textContent = message;
  seatMessage.dataset.state = state;
}

function updateEntryGate() {
  if (!confirmEntryButton) {
    return;
  }

  const canEnter = Boolean(selectedSeat) && isEntryOpen();
  confirmEntryButton.hidden = !selectedSeat;
  confirmEntryButton.disabled = !canEnter;

  if (selectedSeat) {
    confirmEntryButton.textContent = canEnter ? "스텝 입장 확인" : "8월 8일 17:00부터 입장 확인";
  } else {
    confirmEntryButton.textContent = "스텝 입장 확인";
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-()（）.]/g, "");
}

function findColumn(headers, names, fallbackIndex) {
  const normalizedNames = names.map(normalizeHeader);
  const index = headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
  return index >= 0 ? index : fallbackIndex;
}

function addSeatRecord(seats, lookupKey, seat, name, isVip = false) {
  if (!/^[a-f0-9]{64}$/.test(lookupKey) || !seat) {
    return;
  }

  const records = seats.get(lookupKey) || [];
  const isDuplicate = records.some((record) => record.seat === seat && record.name === name);

  if (!isDuplicate) {
    records.push({ seat, name, isVip });
    seats.set(lookupKey, records);
  } else if (isVip) {
    records
      .filter((record) => record.seat === seat && record.name === name)
      .forEach((record) => {
        record.isVip = true;
      });
  }
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getSeatLookupResult(matches) {
  const names = uniqueValues(matches.map((match) => match.name));
  const seats = uniqueValues(matches.map((match) => match.seat));

  return {
    name: names[0] || "",
    names,
    seats,
    seatText: seats.join(" · "),
    isVip: matches.some((match) => match.isVip)
  };
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  const seats = new Map();

  if (!rows.length) {
    return seats;
  }

  const headers = rows[0];
  const lookupIndex = findColumn(headers, ["phone_hash", "phoneHash", "lookup_key", "lookupKey", "hash"], 0);
  const seatIndex = findColumn(headers, ["seat", "좌석", "좌석번호", "seatno"], 1);
  const nameIndex = findColumn(headers, ["name", "guest", "이름", "성명", "참석자"], 2);
  const vipIndex = findColumn(headers, ["vip", "VIP", "등급", "grade", "type"], -1);

  rows.slice(1).forEach((row) => {
    const lookupKey = (row[lookupIndex] || "").trim().toLowerCase();
    const seat = (row[seatIndex] || "").trim();
    const name = (row[nameIndex] || "").trim();
    const vipValue = vipIndex >= 0 ? (row[vipIndex] || "").trim().toLowerCase() : "";
    addSeatRecord(seats, lookupKey, seat, name, vipValue === "vip");
  });

  return seats;
}

async function loadGuestSeats() {
  try {
    const response = await fetch("seats.csv", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Seat list unavailable");
    }

    guestSeats = parseCsv(await response.text());
    seatListReady = true;
    seatListLoadFailed = false;
  } catch {
    guestSeats = new Map();
    seatListReady = false;
    seatListLoadFailed = true;
  }
}

function resetSeatLookup() {
  selectedSeat = "";
  if (seatInput) {
    seatInput.value = "";
  }
  seatLookupForm?.classList.remove("is-found");
  if (seatDisplay) {
    seatDisplay.textContent = "";
  }
  if (guestNameDisplay) {
    guestNameDisplay.textContent = "";
  }
  if (vipTitle) {
    vipTitle.hidden = true;
  }
  setSeatMessage("전화번호를 입력하면 좌석이 표시됩니다.");
  updateEntryGate();
}

function openTicket() {
  ticket?.classList.remove("is-unlocked");
  resetSeatLookup();
  if (!modal) {
    return;
  }
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  window.clearTimeout(ticketOpenTimer);
  ticketOpenTimer = window.setTimeout(() => {
    ticket?.classList.add("is-unlocked");
  }, 720);
}

function closeTicket() {
  if (!modal) {
    return;
  }
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  ticket?.classList.remove("is-unlocked");
  window.clearTimeout(ticketOpenTimer);
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === screenId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showFolder(options = {}) {
  const shouldConfirmEntry = Boolean(options.confirmEntry);

  if (shouldConfirmEntry && (!selectedSeat || !isEntryOpen())) {
    return;
  }
  closeTicket();
  if (shouldConfirmEntry && entryStatus) {
    entryStatus.textContent = "입장 완료";
  }
  if (app) {
    app.dataset.screen = "folder";
  }
  showScreen("folder-screen");
}

function showHome() {
  closeTicket();
  if (app) {
    app.dataset.screen = "home";
  }
  showScreen("home-screen");
}

function showGuide(tabName = "program") {
  if (app) {
    app.dataset.screen = "guide";
  }
  activateTab(tabName);
  showScreen("guide-screen");
}

function activateTab(tabName) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === tabName);
  });
}

openTicketButtons.forEach((button) => {
  button.addEventListener("click", openTicket);
});

closeTicketButtons.forEach((button) => {
  button.addEventListener("click", closeTicket);
});

openInfoButtons.forEach((button) => {
  button.addEventListener("click", () => showFolder());
});

openDirectionsButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeTicket();
    showGuide("directions");
  });
});

unlockTicketButton?.addEventListener("click", () => {
  window.clearTimeout(ticketOpenTimer);
  ticket?.classList.add("is-unlocked");
});

seatInput?.addEventListener("input", () => {
  seatInput.value = seatInput.value.replace(/\D/g, "").slice(0, 11);
});

seatLookupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const phoneKey = seatInput?.value.replace(/\D/g, "") || "";

  selectedSeat = "";

  if (seatListLoadFailed) {
    seatLookupForm?.classList.remove("is-found");
    setSeatMessage("좌석 명단을 불러오지 못했습니다. 스텝에게 문의해 주세요.", "error");
    updateEntryGate();
    return;
  }

  if (!seatListReady) {
    seatLookupForm?.classList.remove("is-found");
    setSeatMessage("좌석 명단을 불러오는 중입니다. 잠시 후 다시 조회해 주세요.", "hold");
    updateEntryGate();
    return;
  }

  if (!/^\d{10,11}$/.test(phoneKey)) {
    seatLookupForm?.classList.remove("is-found");
    setSeatMessage("전화번호 전체를 숫자로 입력해 주세요.", "error");
    updateEntryGate();
    return;
  }

  const lookupKey = await getLookupKey(phoneKey);
  const matches = guestSeats.get(lookupKey) || [];

  if (!matches.length) {
    seatLookupForm?.classList.remove("is-found");
    setSeatMessage("등록된 좌석을 찾을 수 없습니다.", "error");
    updateEntryGate();
    return;
  }

  const lookupResult = getSeatLookupResult(matches);

  if (lookupResult.error) {
    seatLookupForm?.classList.remove("is-found");
    setSeatMessage(lookupResult.error, "error");
    updateEntryGate();
    return;
  }

  selectedSeat = lookupResult.seatText;
  seatLookupForm?.classList.add("is-found");
  if (seatDisplay) {
    seatDisplay.innerHTML = "";
    const hasManySeats = lookupResult.seats.length >= 3;
    seatDisplay.classList.toggle("has-many-seats", hasManySeats);

    if (hasManySeats) {
      lookupResult.seats.forEach((seat) => {
        const seatItem = document.createElement("span");
        seatItem.textContent = seat;
        seatDisplay.append(seatItem);
      });
    } else {
      seatDisplay.textContent = selectedSeat;
    }
  }
  if (guestNameDisplay) {
    const companionCount = Math.max(lookupResult.seats.length - 1, 0);
    const companionLabel = companionCount ? ` 외 ${companionCount}석` : "";
    guestNameDisplay.textContent = lookupResult.name ? `${lookupResult.name}님${companionLabel}` : "";
  }
  if (vipTitle) {
    vipTitle.hidden = !lookupResult.isVip;
  }
  setSeatMessage(
    isEntryOpen() ? "좌석 확인이 완료되었습니다." : "입장 확인은 2026.08.08. 17:00부터 가능합니다.",
    isEntryOpen() ? "success" : "hold"
  );
  updateEntryGate();
});

confirmEntryButton?.addEventListener("click", () => showFolder({ confirmEntry: true }));

folderButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showGuide(button.dataset.folderTab);
  });
});

homeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showHome();
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTicket();
  }
});

loadGuestSeats();

updateEntryGate();
entryGateTimer = window.setInterval(() => {
  const wasDisabled = confirmEntryButton?.disabled;
  updateEntryGate();
  if (selectedSeat && wasDisabled && !confirmEntryButton?.disabled) {
    setSeatMessage("좌석 확인이 완료되었습니다.", "success");
  }
}, 30000);
