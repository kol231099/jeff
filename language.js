// ===== 語言選擇頁 =====
const cards = [...document.querySelectorAll('.lang-card')];
const confirmBtn = document.getElementById('langConfirm');
const confirmText = document.getElementById('confirmText');

// 進來時預選目前語言，讓人知道現在是哪一種
let picked = (window.getLang ? getLang() : 'zh');

const CONFIRM_LABEL = {
  zh: '確定，用中文逛 →',
  en: 'Confirm — browse in English →',
};
const POURING_WORD = { zh: '正在為你倒酒', en: 'POURING' };

function paint() {
  cards.forEach(c => c.classList.toggle('selected', c.dataset.pick === picked));
  confirmBtn.disabled = false;
  confirmText.textContent = CONFIRM_LABEL[picked];
}

cards.forEach(c => {
  c.addEventListener('click', () => { picked = c.dataset.pick; paint(); });
});

confirmBtn.addEventListener('click', async () => {
  confirmBtn.disabled = true;
  // 先落地語言設定，過場結束後首頁就是新語言
  if (window.setLang) setLang(picked);
  await pourTo('index.html', POURING_WORD[picked]);
});

paint();
