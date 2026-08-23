// ===== 多語系 =====
// 必須在其他頁面腳本之前載入。靜態文字用 data-i18n 標記，
// 動態產生的字串呼叫 t()，兩者共用同一份字典。
(function () {
  const DICT = {
    zh: {
      'title.home': 'PourMatch — AI 飲酒交友',
      'title.quiz': '品味測驗 · PourMatch',
      'title.cocktail': '調酒生成器 · PourMatch',
      'title.match': 'AI 酒友配對 · PourMatch',
      'title.community': '社群 · PourMatch',
      'title.about': '關於 · PourMatch',
      'title.profile': '關於我 · PourMatch',
      'title.history': '我的歷史 · PourMatch',
      'title.friends': '朋友 · PourMatch',
      'title.share': '分享 · PourMatch',
      'nav.home': '首頁',
      'nav.quiz': '品味測驗',
      'nav.cocktail': '調酒生成器',
      'nav.community': '社群',
      'nav.match': 'AI 配對',
      'nav.about': '關於',
      'nav.login': '使用 Google 登入',
      'nav.logout': '登出',

      'common.loading': '載入中…',
      'common.retry': '重試',
      'common.login_first': '請先登入',
      'common.cancel': '取消',
      'common.back': '返回',
      'common.online': '在線',
      'common.offline': '離線',

      'home.badge': 'AI 智能配對 · 2026 新世代飲酒社群',
      'home.title_1': '喝一杯',
      'home.title_2': '遇見對的人',
      'home.desc': '用 <strong>AI</strong> 分析你的味覺偏好、個性與場合，<br/>為你量身打造專屬飲品，並推薦<strong>志同道合的酒友</strong>。',
      'home.cta_quiz': '開始我的品味測驗',
      'home.cta_cocktail': '🍹 調酒生成器',
      'home.cta_showcase': 'THE POUR · 3D 展示',
      'home.stat_users': '活躍用戶',
      'home.stat_drinks': '精選酒款',
      'home.stat_satisfaction': '配對滿意度',
      'home.card_wine': '紅酒',
      'home.card_wine_tag': '果香 · 濃郁',
      'home.card_whisky': '威士忌',
      'home.card_whisky_tag': '煙燻 · 深沉',
      'home.card_martini': '馬丁尼',
      'home.card_martini_tag': '優雅 · 俐落',
      'home.card_beer': '精釀啤酒',
      'home.card_beer_tag': '清爽 · 隨興',
      'home.flavor_index': '風味指數',
      'home.match_rate': '配對成功率',
      'home.ai_pick': 'AI 推薦',
      'home.feat1_t': 'AI 味覺分析',
      'home.feat1_d': '12 題深入分析你的風味 DNA',
      'home.feat2_t': '同好配對',
      'home.feat2_d': '用酒單找到氣味相投的人',
      'home.feat3_t': '情境推薦',
      'home.feat3_d': '心情、場合、天氣一鍵搭配',
      'home.feat4_t': '品酒日記',
      'home.feat4_d': '紀錄喝過的每一杯與心情',
      'home.when_t': '什麼時候，最適合來一杯？',
      'home.when_lead': '不是只有派對才需要酒。PourMatch 替你讀懂每一個微小情緒，把對的酒在對的時間遞到你手裡。',
      'home.s1_t': '失眠的深夜',
      'home.s1_d': '大腦關不掉的那種夜，AI 會推一杯柔軟、甜度剛好、能讓肩膀放下的調酒。',
      'home.s1_tag': '低酒精 · 助眠系',
      'home.s2_t': '想為他/她調一杯',
      'home.s2_d': '輸入對方的個性，AI 替你譯成一杯只屬於兩人的飲品。比情書更難複製。',
      'home.s2_tag': '禮物模式 · 客製',
      'home.s3_t': '朋友臨時來家裡',
      'home.s3_d': '冰箱只有半瓶威士忌？告訴 AI 你有什麼，立刻給你一份能變出來的酒單。',
      'home.s3_tag': '在家酒吧 · 即興',
      'home.s4_t': '結束一場硬仗後',
      'home.s4_d': '專案上線、考完試、簡報結束。給自己一杯像獎牌的酒，AI 懂這種儀式感。',
      'home.s4_tag': '犒賞模式 · 強勁',
      'home.recent_t': '看看 AI 最近<span class="gradient-text">為大家調了什麼</span>',
      'home.recent_lead': '每一杯都是地球上獨一無二的配方。AI 沒重複過，也不會重複你的。',
      'home.c1_tags': '<span>🍑 果香</span><span>🌸 花香</span><span>微醺</span>',
      'home.c1_story': '為一個剛搬到新城市的人調的，像第一道從窗簾縫透進來的晨光。',
      'home.c2_tags': '<span>🔥 煙燻</span><span>🌿 草本</span><span>強勁</span>',
      'home.c2_story': '寫給凌晨三點還在 debug 的工程師——苦得剛好，能把腦袋燒亮。',
      'home.c3_tags': '<span>🍫 可可</span><span>🥛 奶香</span><span>濃郁</span>',
      'home.c3_story': '給一個剛失戀的人，甜到讓你以為一切沒事，後勁卻說了實話。',
      'home.pulse': '過去 24 小時，AI 已替全球用戶調出 <strong>2,847</strong> 杯獨一無二的飲品 · 完成 <strong>193</strong> 次味蕾配對',
      'home.faq_t': '大家都在問',
      'home.faq_lead': '第一次用 PourMatch？這幾題大概會替你解答 80% 的疑問。',
      'home.q1': '不會喝酒，也能用嗎？',
      'home.a1': '完全可以。AI 調酒生成器可以把酒精強度調到「微醺」甚至生成 <strong>無酒精 mocktail</strong>。我們關心的是味覺與情緒，不是你的酒量。',
      'home.q2': 'AI 給的調酒配方真的能在家做嗎？',
      'home.a2': 'AI 會以家用酒吧能取得的材料優先生成配方，並附上分量、步驟與裝飾建議。如果碰到稀有材料，AI 也會提供常見替代品。',
      'home.q3': '配對到的酒友會看到我的個資嗎？',
      'home.a3': '不會。預設只顯示頭像、暱稱與你公開的味覺檔案。要不要進一步聯繫，由你決定。每位用戶都有獨一無二的 <strong>6 碼識別代碼</strong>，只在你願意分享時才會曝光。',
      'home.q4': '需要付費嗎？',
      'home.a4': '核心功能（風味測驗、AI 調酒、社群、配對、好友）<strong>完全免費</strong>。Google 一鍵登入即可開始，沒有訂閱門檻。',
      'home.q5': '我的測驗結果可以分享給沒註冊的朋友嗎？',
      'home.a5': '可以。每個測驗結果與 AI 調酒都能生成 <strong>公開分享連結</strong>，朋友不用註冊就能看到，貼到 IG、Threads、Discord 都行。',
      'home.q6': '未滿法定飲酒年齡能用嗎？',
      'home.a6': 'PourMatch 服務僅供 <strong>已達當地合法飲酒年齡</strong> 的使用者。未達標的朋友建議使用 mocktail（無酒精）模式，或先收藏起來，等到了再回來。',
      'home.final_t': '下一杯，<span class="gradient-text">由 AI 替你倒</span>',
      'home.final_sub': '60 秒解鎖你的風味 DNA · Google 一鍵登入 · 完全免費',
      'home.final_cta1': '立即開始品味測驗',
      'home.final_cta2': '🍹 直接調一杯',
      'nav.profile': '🧬 關於我',
      'nav.friends': '👥 朋友',
      'nav.history': '📚 我的歷史',
      'nav.logout_menu': '🚪 登出',
    },
    en: {
      'title.home': 'PourMatch — drink well, meet well',
      'title.quiz': 'Taste Quiz · PourMatch',
      'title.cocktail': 'Cocktail Lab · PourMatch',
      'title.match': 'Matching · PourMatch',
      'title.community': 'Community · PourMatch',
      'title.about': 'About · PourMatch',
      'title.profile': 'Profile · PourMatch',
      'title.history': 'History · PourMatch',
      'title.friends': 'Friends · PourMatch',
      'title.share': 'Shared · PourMatch',
      'nav.home': 'Home',
      'nav.quiz': 'Taste Quiz',
      'nav.cocktail': 'Cocktail Lab',
      'nav.community': 'Community',
      'nav.match': 'Matching',
      'nav.about': 'About',
      'nav.login': 'Sign in with Google',
      'nav.logout': 'Sign out',

      'common.loading': 'Loading…',
      'common.retry': 'Try again',
      'common.login_first': 'Please sign in first',
      'common.cancel': 'Cancel',
      'common.back': 'Back',
      'common.online': 'Online',
      'common.offline': 'Offline',

      'home.badge': 'AI matching · a new kind of drinking community',
      'home.title_1': 'One drink,',
      'home.title_2': 'the right people',
      'home.desc': 'Let <strong>AI</strong> read your palate, your mood and the occasion,<br/>then pour you something of your own — and find <strong>people who drink like you</strong>.',
      'home.cta_quiz': 'Take the taste quiz',
      'home.cta_cocktail': '🍹 Cocktail Lab',
      'home.cta_showcase': 'THE POUR · 3D',
      'home.stat_users': 'active drinkers',
      'home.stat_drinks': 'curated bottles',
      'home.stat_satisfaction': 'match satisfaction',
      'home.card_wine': 'Red wine',
      'home.card_wine_tag': 'fruity · full',
      'home.card_whisky': 'Whisky',
      'home.card_whisky_tag': 'smoky · deep',
      'home.card_martini': 'Martini',
      'home.card_martini_tag': 'elegant · clean',
      'home.card_beer': 'Craft beer',
      'home.card_beer_tag': 'crisp · easy',
      'home.flavor_index': 'Flavour index',
      'home.match_rate': 'Match rate',
      'home.ai_pick': 'AI pick',
      'home.feat1_t': 'AI palate reading',
      'home.feat1_d': 'Twelve questions map your flavour DNA',
      'home.feat2_t': 'Find your people',
      'home.feat2_d': 'Matched on what you actually drink',
      'home.feat3_t': 'Reads the moment',
      'home.feat3_d': 'Mood, occasion and weather in one tap',
      'home.feat4_t': 'Tasting journal',
      'home.feat4_d': 'Keep every glass and how it felt',
      'home.when_t': 'When is the right time for a drink?',
      'home.when_lead': 'Parties are not the only occasion. PourMatch reads the smaller moods too, and hands you the right glass at the right moment.',
      'home.s1_t': 'A sleepless night',
      'home.s1_d': 'For the nights your head will not switch off — something soft, just sweet enough, that lets your shoulders drop.',
      'home.s1_tag': 'low ABV · winding down',
      'home.s2_t': 'Mixing one for someone',
      'home.s2_d': 'Describe them and the AI translates it into a drink that belongs to the two of you. Harder to copy than a love letter.',
      'home.s2_tag': 'gift mode · bespoke',
      'home.s3_t': 'Friends turn up unannounced',
      'home.s3_d': 'Half a bottle of whisky in the fridge? Tell the AI what you have and get a menu you can actually make.',
      'home.s3_tag': 'home bar · improvised',
      'home.s4_t': 'After a hard-won day',
      'home.s4_d': 'Shipped, graded, presented. Pour yourself something that feels like a medal — the AI understands the ceremony.',
      'home.s4_tag': 'reward mode · strong',
      'home.recent_t': 'What the AI has been <span class="gradient-text">pouring lately</span>',
      'home.recent_lead': 'Every recipe is one of a kind. None have repeated, and yours will not either.',
      'home.c1_tags': '<span>🍑 fruity</span><span>🌸 floral</span><span>light</span>',
      'home.c1_story': 'Mixed for someone who just moved to a new city — like the first light through a gap in the curtains.',
      'home.c2_tags': '<span>🔥 smoky</span><span>🌿 herbal</span><span>strong</span>',
      'home.c2_story': 'For the engineer still debugging at three in the morning. Bitter enough to light the brain back up.',
      'home.c3_tags': '<span>🍫 cacao</span><span>🥛 creamy</span><span>rich</span>',
      'home.c3_story': 'For someone freshly heartbroken. Sweet enough to pretend nothing happened, until the finish tells the truth.',
      'home.pulse': 'In the last 24 hours the AI has poured <strong>2,847</strong> one-of-a-kind drinks and made <strong>193</strong> palate matches',
      'home.faq_t': 'Common questions',
      'home.faq_lead': 'First time here? These six probably cover most of it.',
      'home.q1': 'Can I use this if I do not drink?',
      'home.a1': 'Absolutely. The generator can dial the strength right down, or build a <strong>zero-proof mocktail</strong>. What it cares about is taste and mood, not how much you can handle.',
      'home.q2': 'Are the recipes actually makeable at home?',
      'home.a2': 'Recipes favour ingredients a home bar can get, with measures, steps and a garnish. Where something rare turns up, the AI offers a common substitute.',
      'home.q3': 'Will people I match with see my personal details?',
      'home.a3': 'No. By default they see your avatar, your display name and the taste profile you chose to publish. Whether it goes further is up to you. Everyone gets a unique <strong>six-character code</strong> that is only visible when you share it.',
      'home.q4': 'Does it cost anything?',
      'home.a4': 'The core — quiz, generator, community, matching, friends — is <strong>free</strong>. Sign in with Google and start; there is no subscription.',
      'home.q5': 'Can I share my result with friends who have not signed up?',
      'home.a5': 'Yes. Every quiz result and recipe can produce a <strong>public link</strong> that works without an account, fine to drop into Instagram, Threads or Discord.',
      'home.q6': 'What if I am under the legal drinking age?',
      'home.a6': 'PourMatch is for people who are <strong>of legal drinking age where they live</strong>. If you are not there yet, use the zero-proof mode, or bookmark it and come back.',
      'home.final_t': 'Your next glass, <span class="gradient-text">poured by AI</span>',
      'home.final_sub': 'Sixty seconds to your flavour DNA · one-tap Google sign-in · free',
      'home.final_cta1': 'Start the taste quiz',
      'home.final_cta2': '🍹 Just mix me one',
      'nav.profile': '🧬 Profile',
      'nav.friends': '👥 Friends',
      'nav.history': '📚 History',
      'nav.logout_menu': '🚪 Sign out',
    },
  };

  const KEY = 'pourmatch_lang';

  function detect() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
    return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  let lang = detect();

  // 缺字時退回中文，再退回 key 本身，避免畫面出現空白
  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) ?? DICT.zh[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    const pageTitle = document.querySelector('meta[name="i18n-title"]');
    if (pageTitle) document.title = t(pageTitle.content);
  }

  function setLang(next) {
    if (next !== 'zh' && next !== 'en') return;
    lang = next;
    localStorage.setItem(KEY, next);
    document.documentElement.lang = next === 'zh' ? 'zh-Hant' : 'en';
    apply();
    syncToggle();
    // 由各頁面自行重繪動態內容
    window.dispatchEvent(new CustomEvent('pourmatch:langchange', { detail: { lang: next } }));
  }

  function syncToggle() {
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
  }

  // 語言切換鈕插在登入鈕旁邊
  function mountToggle() {
    const nav = document.querySelector('.navbar');
    if (!nav || nav.querySelector('.lang-switch')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.innerHTML = `
      <button class="lang-btn" data-lang="zh" type="button">中</button>
      <button class="lang-btn" data-lang="en" type="button">EN</button>`;
    wrap.addEventListener('click', e => {
      const b = e.target.closest('.lang-btn');
      if (b) setLang(b.dataset.lang);
    });
    const loginBtn = nav.querySelector('.btn-login, .user-chip, #userArea');
    if (loginBtn) nav.insertBefore(wrap, loginBtn);
    else nav.appendChild(wrap);
    syncToggle();
  }

  window.t = t;
  window.getLang = () => lang;
  window.setLang = setLang;
  window.applyI18n = apply;

  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.addEventListener('DOMContentLoaded', () => { mountToggle(); apply(); });
  // auth.js 重建導覽列右側時要把切換鈕補回來
  window.addEventListener('pourmatch:authchange', () => { mountToggle(); apply(); });
})();
