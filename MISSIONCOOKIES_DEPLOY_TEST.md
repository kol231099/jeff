# missioncookies 一條龍部署與 AI 測試

## 第一次設定

在 `/Users/kol/Desktop/jeff` 裡建立設定檔：

```bash
cp missioncookies.env.example missioncookies.env
```

編輯 `missioncookies.env`，確認這幾個值：

```env
MISSIONCOOKIES_SSH=root@YOUR_DROPLET_IP
MISSIONCOOKIES_WEB_DIR=/var/www/missioncookies
MISSIONCOOKIES_APP_DIR=/var/www/missioncookies
MISSIONCOOKIES_RESTART_CMD=pm2 restart missioncookies
MISSIONCOOKIES_TEST_URL=http://missioncookies.cv/ai-exam-test.html
```

如果 droplet 上網站不是放在 `/var/www/missioncookies`，要改成實際路徑。

如果 Node 後端不是用 `pm2 restart missioncookies` 重啟，也要改成實際指令，例如：

```env
MISSIONCOOKIES_RESTART_CMD=pm2 restart server
```

或：

```env
MISSIONCOOKIES_RESTART_CMD=systemctl restart missioncookies
```

## 每次更新加測試

只要跑：

```bash
cd /Users/kol/Desktop/jeff
bash deploy_and_test_missioncookies.sh
```

腳本會自動：

1. 上傳測試頁到 droplet。
2. 上傳 `server.js`。
3. 重啟後端。
4. 檢查 `http://missioncookies.cv/api/ai-exam-health`。
5. 開 Chrome 到 `http://missioncookies.cv/ai-exam-test.html`。
6. 自動點「開始完整測試」。
7. 偵測獨立作答視窗的新 URL。
8. 等待網頁回傳 AI 預測結果。
9. 在終端印出結果。

## 網頁測試入口

部署後也可以手動打開：

```text
http://missioncookies.cv/ai-exam-test.html
```

如果頁面顯示「系統自檢通過」，代表後端和 OpenAI API key 都準備好了。

## 常見問題

- `OPENAI_API_KEY 尚未設定`：droplet 後端環境變數沒有設定，或重啟後沒有載入。
- `Permission denied`：本機 SSH key 沒有權限登入 droplet。
- `pm2: command not found`：droplet 不是用 pm2 管理後端，請改 `MISSIONCOOKIES_RESTART_CMD`。
- 找不到頁面：`MISSIONCOOKIES_WEB_DIR` 不是 Nginx 實際服務的網站目錄。
