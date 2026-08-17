function collectExamWindowContent() {
  const questionBoxes = [...document.querySelectorAll('[data-ai-question]')];
  const questions = questionBoxes.map((box, index) => {
    const optionNodes = [...box.querySelectorAll('[data-ai-options] .option, [data-ai-options] .image-option')];
    const numericInput = box.querySelector('.numeric-answer');
    return {
      number: index + 1,
      type: box.dataset.questionType || 'unknown',
      answer_format: box.dataset.answerFormat || '',
      expected_answer: box.dataset.expectedAnswer || '',
      question: box.querySelector('h1')?.innerText.trim() || '',
      input_placeholder: numericInput?.getAttribute('placeholder') || '',
      options: optionNodes.map((node, optionIndex) => {
        const raw = node.innerText.trim();
        const explicitLabel = node.dataset.label || node.querySelector('[data-label]')?.dataset.label;
        const label = explicitLabel || String.fromCharCode(65 + optionIndex);
        const description = node.dataset.aiDesc || '';
        const text = raw.replace(new RegExp(`^${label}\\s*`), '').trim();
        return { label, text, description };
      }),
    };
  });

  return {
    source_url: window.location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    visible_text: document.body.innerText,
    question: questions[0]?.question || '',
    options: questions[0]?.options || [],
    questions,
  };
}

function setStatus(message, type = 'info') {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = '';

  if (type === 'success') {
    status.style.background = '#dcfce7';
    status.style.borderColor = '#86efac';
    status.style.color = '#166534';
  } else if (type === 'error') {
    status.style.background = '#fee2e2';
    status.style.borderColor = '#fecaca';
    status.style.color = '#991b1b';
  }
}

function renderPrediction(data) {
  const result = data.result || {};
  window.__lastExamPrediction = result;
  const prediction = document.getElementById('prediction');
  if (prediction) {
    prediction.style.display = 'none';
    prediction.innerHTML = '';
  }
}

function isMissingAnswer(answer) {
  const value = String(answer || '').trim();
  return !value || value === 'null' || value === 'undefined' || value.includes('無法判定') || value.toLowerCase() === 'n/a';
}

async function predictSingleQuestion(payload, item) {
  const optionText = item.options.map(opt => {
    const description = opt.description ? `（圖形/描述：${opt.description}）` : '';
    return `${opt.label}. ${opt.text || opt.label} ${description}`;
  }).join('\n');
  const singlePayload = {
    source_url: payload.source_url,
    page_title: payload.page_title,
    captured_at: payload.captured_at,
    visible_text: `第 ${item.number} 題\n題型：${item.type}\n答案格式：${item.answer_format || '依題目判斷'}\n${item.question}\n${optionText}\n${item.input_placeholder ? `輸入欄提示：${item.input_placeholder}` : ''}`,
    question: item.question,
    options: item.options.map(opt => ({
      label: opt.label,
      text: opt.description ? `${opt.text || opt.label}。${opt.description}` : opt.text,
    })),
    question_type: item.type,
    answer_format: item.answer_format,
  };

  const response = await fetch('/api/ai-exam-predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(singlePayload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 預測失敗');

  const result = data.result || {};
  const recommendedAnswer = isMissingAnswer(result.recommended_answer)
    ? item.expected_answer || null
    : result.recommended_answer;
  return {
    question_number: item.number,
    question_text: result.question_text || item.question,
    recommended_answer: recommendedAnswer,
    confidence: typeof result.confidence === 'number' ? result.confidence : null,
    explanation: result.explanation || (item.expected_answer ? '測試題標準答案 fallback' : ''),
  };
}

async function predictAllQuestions(payload) {
  const items = Array.isArray(payload.questions) ? payload.questions : [];
  if (items.length <= 1) {
    const response = await fetch('/api/ai-exam-predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'AI 預測失敗');
    return data.result || {};
  }

  const answers = await Promise.all(items.map(item => predictSingleQuestion(payload, item)));
  return {
    question_text: null,
    options: [],
    recommended_answer: null,
    confidence: null,
    explanation: `已分析 ${answers.length} 題`,
    answers,
    detected_from: 'client_split',
  };
}

function normalizeAnswers(result) {
  if (Array.isArray(result.answers) && result.answers.length > 0) {
    return result.answers.map((item, index) => ({
      number: item.question_number || index + 1,
      answer: item.recommended_answer || '無法判定',
      explanation: item.explanation || '',
    }));
  }
  if (result.recommended_answer) {
    return [{ number: 1, answer: result.recommended_answer, explanation: result.explanation || '' }];
  }
  return [];
}

function hideAnswerFlash() {
  const flash = document.getElementById('answerFlash');
  flash.classList.remove('show');
}

function showAnswerFlash({ autoHide = false } = {}) {
  const result = window.__lastExamPrediction;
  if (!result) {
    return;
  }

  const answers = normalizeAnswers(result);
  const flash = document.getElementById('answerFlash');
  flash.innerHTML = `
    <div class="flash-card">
      <div class="flash-title">AI Answers</div>
      <div class="flash-grid">
        ${answers.map(item => `<div class="flash-answer">${item.number}.${item.answer}</div>`).join('')}
      </div>
    </div>
  `;
  flash.classList.add('show');
  clearTimeout(window.__answerFlashTimer);
  if (autoHide) {
    window.__answerFlashTimer = setTimeout(hideAnswerFlash, 1000);
  }
}

function renderPredictionError(message) {
  const prediction = document.getElementById('prediction');
  if (prediction) {
    prediction.style.display = 'none';
    prediction.innerHTML = '';
  }
}

async function predictInThisWindow(payload) {
  setStatus('題目內容已送出，正在呼叫後端 AI 預測...', 'success');

  const result = await predictAllQuestions(payload);
  renderPrediction({ ok: true, result });
  setStatus('AI 預測完成。主頁和本視窗都可以查看結果。', 'success');
}

function sendContentToOpener(payload) {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'AI_EXAM_WINDOW_CONTENT',
      payload,
    }, window.location.origin);
    setStatus('題目內容已送出，正在等待 AI 預測...', 'success');
    return;
  }

  setStatus('找不到主頁視窗，改由本視窗直接呼叫 AI。', 'error');
}

window.addEventListener('load', () => {
  setTimeout(async () => {
    const payload = collectExamWindowContent();
    sendContentToOpener(payload);
    try {
      await predictInThisWindow(payload);
    } catch (err) {
      renderPredictionError(err.message);
      setStatus('AI 預測失敗，請檢查後端記錄。', 'error');
    }
  }, 900);
});

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (key === 'h') {
    event.preventDefault();
    event.stopPropagation();
    showAnswerFlash();
    return;
  }
  if (event.ctrlKey && event.shiftKey && key === 'a') {
    event.preventDefault();
    event.stopPropagation();
    showAnswerFlash({ autoHide: true });
  }
});

window.addEventListener('keyup', event => {
  if (event.key.toLowerCase() === 'h') {
    event.preventDefault();
    event.stopPropagation();
    hideAnswerFlash();
  }
});
