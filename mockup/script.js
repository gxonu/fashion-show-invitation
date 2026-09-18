const dialog = document.querySelector('#ticket-dialog');
const form = document.querySelector('#ticket-form');
const phone = document.querySelector('#phone');
const message = document.querySelector('#lookup-message');
const result = document.querySelector('#seat-result');
const submit = document.querySelector('#lookup-button');
let opener;
let lookupVersion = 0;
function resetTicket() {
  lookupVersion += 1;
  form.reset();
  result.hidden = true;
  submit.disabled = false;
  submit.textContent = '좌석 확인 ↗';
  message.textContent = '번호를 입력해 나의 좌석을 확인해 주세요.';
  delete message.dataset.state;
}
document.querySelectorAll('[data-ticket]').forEach(button => button.addEventListener('click', () => {
  opener = button;
  resetTicket();
  dialog.showModal();
  document.body.classList.add('body-locked');
  // Keep the invitation visible before opening the mobile keyboard.
  dialog.querySelector('.close-dialog').focus({preventScroll: true});
}));
function closeTicket() { dialog.close(); }
dialog.querySelector('.close-dialog').addEventListener('click', closeTicket);
dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) closeTicket(); } });
dialog.addEventListener('close', () => { lookupVersion += 1; document.body.classList.remove('body-locked'); opener?.focus({preventScroll:true}); });
phone.addEventListener('input', () => { phone.value = phone.value.replace(/[^\d-]/g, '').slice(0,13); lookupVersion += 1; result.hidden = true; delete message.dataset.state; message.textContent='번호를 입력해 나의 좌석을 확인해 주세요.'; submit.disabled=false; submit.textContent='좌석 확인 ↗'; });
document.querySelector('#fill-demo').addEventListener('click', () => {phone.value='01000000001'; form.requestSubmit();});
function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) { const c=text[i]; if(c==='"' && quoted && text[i+1]==='"'){cell+='"';i++;} else if(c==='"'){quoted=!quoted;} else if(c===','&&!quoted){row.push(cell);cell='';} else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++; row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';} else cell+=c; }
  row.push(cell);if(row.some(Boolean))rows.push(row);
  const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').trim());
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||'').trim()])));
}
form.addEventListener('submit', async event => {
  event.preventDefault(); const version=++lookupVersion; const value=phone.value.replace(/\D/g,''); result.hidden=true;
  if(!/^0\d{9,10}$/.test(value)){message.textContent='휴대전화번호 10~11자리를 확인해 주세요.';message.dataset.state='error';return;}
  submit.disabled=true;submit.textContent='확인 중…';delete message.dataset.state;message.textContent='초대장을 확인하고 있습니다.';
  try {
    const response=await fetch('../seats.csv',{cache:'no-store'});if(!response.ok)throw new Error('roster');
    const rows=parseCSV(await response.text());
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
    if(version!==lookupVersion)return;
    const matches=rows.filter(row=>row.phone_hash===hash);
    if(!matches.length){message.textContent='등록된 좌석이 없습니다. 초대받은 번호를 확인해 주세요.';message.dataset.state='error';return;}
    document.querySelector('#seat-number').textContent=[...new Set(matches.map(row=>row.seat))].join(' · ');
    const name=matches.find(row=>row.name)?.name;
    document.querySelector('#guest-name').textContent=name?name+'님을 기다립니다.':'당신을 위한 자리';
    document.querySelector('#guest-grade').textContent=matches.some(row=>row.vip.toLowerCase()==='vip')?'VIP INVITATION':'GUEST INVITATION';
    result.hidden=false;message.textContent='좌석 확인이 완료되었습니다. 현장에서 이 화면을 보여주세요.';
  } catch(error) { if(version===lookupVersion){message.textContent='명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';message.dataset.state='error';} }
  finally { if(version===lookupVersion){submit.disabled=false;submit.textContent='좌석 확인 ↗';} }
});
const lookList=document.querySelector('#look-list'),search=document.querySelector('#look-search'),more=document.querySelector('#more-looks'),status=document.querySelector('#look-status');
let limit=6;
function renderLooks(){
  const query=search.value.trim().toLocaleLowerCase();
  const filtered=window.FASHION_LOOKS.filter(look=>[look.name,look.english,look.title,look.number].join(' ').toLocaleLowerCase().includes(query));
  lookList.replaceChildren();
  for(const look of filtered.slice(0,limit)){
    const details=document.createElement('details');details.className='look';
    const summary=document.createElement('summary');
    const number=document.createElement('span');number.className='look-number';number.textContent='LOOK '+look.number.padStart(2,'0');
    const name=document.createElement('span');name.className='look-name';name.textContent=look.name;
    const english=document.createElement('small');english.textContent=look.english;name.append(english);
    const title=document.createElement('span');title.className='look-title';title.textContent=look.title;
    const plus=document.createElement('span');plus.className='look-plus';plus.textContent='＋';plus.setAttribute('aria-hidden','true');
    summary.append(number,name,title,plus);const description=document.createElement('p');description.textContent=look.description;
    details.append(summary,description);lookList.append(details);
  }
  status.textContent=filtered.length?`${Math.min(limit,filtered.length)} / ${filtered.length} LOOKS`:'검색 결과가 없습니다. 다른 이름이나 작품명을 입력해 주세요.';
  more.hidden=limit>=filtered.length;
}
search.addEventListener('input',()=>{limit=6;renderLooks();});
more.addEventListener('click',()=>{limit+=8;renderLooks();});
renderLooks();
