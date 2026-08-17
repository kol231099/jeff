const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const steps = [...document.querySelectorAll('.step')];
const resultEl = document.getElementById('result');
let entranceRef = null;
let answerRef = null;
let healthReady = false;
const LOGIN_PATH = '/ai-ilearning-login.html';
const QUIZ_VIEW_PATH = '/ai-ilearning-view.html';
const QUIZ_VIEW_ID = '251494';

function setStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle('done', i < index);
    step.classList.toggle('active', i === index);
  });
}

function renderWaiting() {
  resultEl.innerHTML = '<div class="empty">等待登入模擬頁開啟...</div>';
}

function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function checkHealth({ showReady = false } = {}) {
  try {
    const response = await fetchWithTimeout('/api/ai-exam-health', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, 8000);
    const data = await response.json();
    healthReady = Boolean(response.ok && data.openai_ready);

    if (!healthReady) {
      renderError('後端有回應，但 OPENAI_API_KEY 尚未設定。請先在 droplet 的後端環境變數設定好後再測。');
      return false;
    }

    if (showReady) {
      resultEl.innerHTML = `
        <h2>系統自檢通過</h2>
        <p class="meta">後端 API 正常，OpenAI 已就緒，模型：${data.model || '未指定'}</p>
      `;
    }
    return true;
  } catch (err) {
    healthReady = false;
    renderError(`無法連線到後端健康檢查：${err.name === 'AbortError' ? '請求逾時' : err.message}`);
    return false;
  }
}

function renderError(message) {
  resultEl.innerHTML = `
    <h2>測試中斷</h2>
    <p class="meta">${message}</p>
  `;
  startBtn.disabled = false;
}

function renderPrediction(payload) {
  const result = payload.result || {};
  const options = Array.isArray(result.options) ? result.options : [];
  resultEl.innerHTML = `
    <h2>AI 預測結果</h2>
    <div class="answer">建議答案：${result.recommended_answer || '無法判定'}</div>
    <div class="meta">
      <strong>信心分數：</strong>${typeof result.confidence === 'number' ? Math.round(result.confidence * 100) + '%' : '未提供'}<br>
      <strong>題目：</strong>${result.question_text || '未擷取到題目'}<br>
      <strong>理由：</strong>${result.explanation || '未提供'}
    </div>
    <div class="options">
      ${options.map(opt => `
        <div class="option"><strong>${opt.label || ''}</strong> ${opt.text || ''}</div>
      `).join('')}
    </div>
    <pre>${JSON.stringify(payload, null, 2)}</pre>
  `;
}

async function predictFromWindowContent(content) {
  setStep(4);
  const response = await fetchWithTimeout('/api/ai-exam-predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  }, 45000);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 預測失敗');
  steps.forEach(step => {
    step.classList.remove('active');
    step.classList.add('done');
  });
  renderPrediction(data);
}

window.addEventListener('message', async event => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === 'MOCK_ILEARNING_LOGIN_READY') {
    setStep(0);
    resultEl.innerHTML = `
      <h2>已開啟登入頁</h2>
      <p class="meta">請在登入視窗任意輸入帳號密碼，送出後會進入期末考入口頁。</p>
    `;
    return;
  }
  if (event.data?.type === 'MOCK_ILEARNING_QUIZ_VIEW_READY') {
    setStep(2);
    resultEl.innerHTML = `
      <h2>已偵測到測驗入口</h2>
      <p class="meta">URL 已符合 <code>${QUIZ_VIEW_PATH}?id=${QUIZ_VIEW_ID}</code>。現在請在入口視窗按「開始作答」。</p>
    `;
    return;
  }
  if (event.data?.type === 'MOCK_ILEARNING_ATTEMPT_WINDOW_OPENED') {
    setStep(3);
    resultEl.innerHTML = `
      <h2>已偵測到獨立作答視窗</h2>
      <p class="meta">作答視窗已開啟，請等待該視窗完成 AI 預測。正式 Python 流程會在這一步切換到新視窗分析。</p>
    `;
    startBtn.disabled = false;
    return;
  }
  if (!event.data || event.data.type !== 'AI_EXAM_WINDOW_CONTENT') return;

  try {
    setStep(4);
    await predictFromWindowContent(event.data.payload);
  } catch (err) {
    renderError(err.message);
  } finally {
    startBtn.disabled = false;
  }
});

function isQuizViewUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith(QUIZ_VIEW_PATH) && parsed.searchParams.get('id') === QUIZ_VIEW_ID;
  } catch {
    return false;
  }
}

function isLoginUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith(LOGIN_PATH);
  } catch {
    return false;
  }
}

function waitForLoginReady() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!entranceRef || entranceRef.closed) {
        clearInterval(timer);
        reject(new Error('登入視窗已關閉'));
        return;
      }
      if (isLoginUrl(entranceRef.location.href)) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 30000) {
        clearInterval(timer);
        reject(new Error('超時：未偵測到登入頁'));
      }
    }, 500);
  });
}

function waitForEntranceReady() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!entranceRef || entranceRef.closed) {
        clearInterval(timer);
        reject(new Error('測驗入口視窗已關閉'));
        return;
      }
      if (isQuizViewUrl(entranceRef.location.href)) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 30000) {
        clearInterval(timer);
        reject(new Error('超時：未偵測到測驗入口 URL'));
      }
    }, 500);
  });
}

function waitForAnswerWindow() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (!entranceRef || entranceRef.closed) {
        clearInterval(timer);
        reject(new Error('測驗入口視窗已關閉'));
        return;
      }
      if (answerRef && !answerRef.closed && answerRef.location.href.includes('/ai-exam-window.html')) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 60000) {
        clearInterval(timer);
        reject(new Error('超時：未偵測到獨立作答視窗'));
      }
    }, 500);
  });
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  const ready = healthReady || await checkHealth();
  if (!ready) {
    startBtn.disabled = false;
    return;
  }

  setStep(0);
  renderWaiting();

  const entranceFeatures = 'popup=yes,width=1280,height=820,left=80,top=60';
  entranceRef = window.open('/ai-ilearning-login.html', 'mockIlearningView', entranceFeatures);

  if (!entranceRef) {
    renderError('瀏覽器阻擋了登入視窗，請允許此網站開啟彈出視窗後再試一次。');
    return;
  }

  entranceRef.focus();

  try {
    await waitForLoginReady();
    setStep(1);
    resultEl.innerHTML = `
      <h2>等待登入</h2>
      <p class="meta">登入頁已開啟，請任意輸入帳號密碼並按登入。</p>
    `;

    await waitForEntranceReady();
    setStep(2);
    resultEl.innerHTML = `
      <h2>已偵測到測驗入口</h2>
      <p class="meta">URL 已符合 <code>${QUIZ_VIEW_PATH}?id=${QUIZ_VIEW_ID}</code>。現在請在入口視窗按「開始作答」。</p>
    `;

    setStep(3);
  } catch (err) {
    renderError(err.message);
  }
});

resetBtn.addEventListener('click', () => {
  setStep(0);
  startBtn.disabled = false;
  resultEl.innerHTML = '<div class="empty">尚未開始測試</div>';
  if (answerRef && !answerRef.closed) answerRef.close();
  if (entranceRef && !entranceRef.closed) entranceRef.close();
});

checkHealth({ showReady: true });
