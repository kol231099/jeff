document.getElementById('beginAttemptBtn').addEventListener('click', () => {
  const popup = window.open('/ai-exam-window.html', 'aiExamWindow', 'popup=yes,width=980,height=780,left=120,top=80');
  if (!popup) {
    alert('瀏覽器阻擋了獨立作答視窗，請允許此網站開啟彈出視窗後再試一次。');
    return;
  }
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'MOCK_ILEARNING_ATTEMPT_WINDOW_OPENED',
      url: popup.location.href,
    }, window.location.origin);
  }
  popup.focus();
});

window.addEventListener('load', () => {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'MOCK_ILEARNING_QUIZ_VIEW_READY',
      url: window.location.href,
    }, window.location.origin);
  }
});
