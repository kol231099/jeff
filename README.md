# PourMatch

**繁體中文** · [English](README.en.md)

以品味測驗為核心的飲酒社群。使用者做完一份 12 題的味覺測驗後，AI 會分析他的飲酒人格並推薦酒款；接著系統以答案的重疊度找出味覺相近的人，雙方都表示想認識才會開啟一對一聊天室。

網站：<https://missioncookies.cv>

## 功能

| 功能 | 說明 |
|---|---|
| 品味測驗 | 12 題（單選、複選、滑桿三種題型），AI 產生風味人格稱號、特質標籤與 4 款推薦 |
| 調酒生成器 | 依偏好即時生成專屬配方；進階模式另有 10 組選項（技法、杯型、飲食限制、命名風格等） |
| 酒友配對 | 依測驗答案計算味覺重疊度，互相表態才配對成功 |
| 聊天室 | 配對成功後開啟，一對一與群組共用同一套房間與訊息機制 |
| 社群 | 發布測驗結果與配方、按讚、留言 |
| THE POUR | 捲動驅動的 3D 展示，Three.js 即時運算，無外部模型或貼圖素材 |

## 技術

- **後端**：Node.js + Express，SQLite（better-sqlite3）
- **登入**：Google Identity Services，JWT 存於 httpOnly cookie
- **AI**：OpenAI（品味測驗、調酒生成、配對評語）
- **前端**：原生 HTML/CSS/JS，無建置流程
- **3D**：Three.js（`vendor/` 內附，不依賴 CDN）

### 配對如何計算

相似度在 [`taste.js`](taste.js)，逐題比對後加權平均：

- 單選題：一致得 1 分
- 複選題：Jaccard 交集除以聯集
- 滑桿題：依差距線性遞減

回傳 0–100 的分數與逐題明細，介面用它顯示「你們在香氣、場合上特別接近」。任一方未作答的題目不計入，不會被當成不一致而扣分。

執行測試：

```bash
node taste.test.js
```

## 本機開發

```bash
npm install
```

建立 `.env`：

```env
PORT=3001
JWT_SECRET=用 openssl rand -hex 32 產生
GOOGLE_CLIENT_ID=你的 Google OAuth 用戶端 ID
OPENAI_API_KEY=你的 OpenAI API key
```

啟動：

```bash
npm start
```

後端只監聽 `127.0.0.1`，靜態檔案預期由 Nginx 提供，並把 `/api/` 反向代理到後端。

## 部署

推送到 `main` 後，在伺服器上：

```bash
git pull && npm install && pm2 restart missioncookies
```

Nginx 需封鎖 `server.js`、`db.js`、`taste.js`、`.env`、`*.db` 等後端檔案 —— 靜態根目錄與應用程式目錄相同，不擋的話這些會被直接下載。

## 已知待辦

- `/api/taste-quiz`、`/api/cocktail-generator`、`/api/match` 沒有速率限制，且前兩者無需登入即可呼叫，會消耗 OpenAI 額度
- 群組配對尚未實作（規劃為湊足人數才成團，避免出現空群組）
- 刪除使用者會在 `rooms` 留下孤兒資料，該表沒有指向 `users` 的外鍵
