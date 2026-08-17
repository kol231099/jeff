const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  window.location.href = '/ai-ilearning-view.html?id=251494';
});

window.addEventListener('load', () => {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'MOCK_ILEARNING_LOGIN_READY',
      url: window.location.href,
    }, window.location.origin);
  }
});
