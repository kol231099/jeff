#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.error
import urllib.request
from html import unescape
from urllib.parse import urlparse, urlunparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

try:
    from webdriver_manager.chrome import ChromeDriverManager
    WEBDRIVER_MANAGER_AVAILABLE = True
except ImportError:
    WEBDRIVER_MANAGER_AVAILABLE = False


TEST_URL = os.getenv("MISSIONCOOKIES_TEST_URL", "http://missioncookies.cv/ai-ilearning-view.html?id=251494")
TIMEOUT = int(os.getenv("MISSIONCOOKIES_TIMEOUT", "60"))
HEADLESS = os.getenv("MISSIONCOOKIES_HEADLESS", "false").lower() == "true"


def health_url_for(test_url):
    parsed = urlparse(test_url)
    origin = urlunparse((parsed.scheme, parsed.netloc, "", "", "", ""))
    return f"{origin}/api/ai-exam-health"


def fetch_json(url, timeout=8):
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def init_driver():
    options = Options()
    options.add_argument("--window-size=1440,980")
    options.add_argument("--disable-popup-blocking")
    if HEADLESS:
        options.add_argument("--headless=new")

    if WEBDRIVER_MANAGER_AVAILABLE:
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=options)
    return webdriver.Chrome(options=options)


def text_content(driver, selector):
    try:
        return driver.find_element(By.CSS_SELECTOR, selector).text.strip()
    except Exception:
        return ""


def main():
    health_url = health_url_for(TEST_URL)
    print(f"==> Checking backend health: {health_url}")
    try:
        health = fetch_json(health_url)
    except urllib.error.URLError as exc:
        print(f"Health check failed: {exc}", file=sys.stderr)
        return 1

    if not health.get("openai_ready"):
        print("Backend is reachable, but OPENAI_API_KEY is not ready on the droplet.", file=sys.stderr)
        print(json.dumps(health, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    print(f"==> OpenAI ready, model={health.get('model')}")
    driver = init_driver()

    try:
        wait = WebDriverWait(driver, TIMEOUT)
        print(f"==> Opening quiz view page: {TEST_URL}")
        driver.get(TEST_URL)
        origin_url = driver.current_url
        origin_handles = set(driver.window_handles)

        wait.until(lambda d: "ai-ilearning-view.html" in d.current_url and "id=251494" in d.current_url)
        wait.until(EC.element_to_be_clickable((By.ID, "beginAttemptBtn")))
        print(f"==> Armed at quiz view URL: {origin_url}")
        print("==> Clicking begin attempt and waiting for the independent answer window")
        driver.find_element(By.ID, "beginAttemptBtn").click()

        wait.until(lambda d: len(set(d.window_handles) - origin_handles) > 0)
        new_handles = list(set(driver.window_handles) - origin_handles)
        answer_handle = new_handles[-1]
        driver.switch_to.window(answer_handle)
        answer_url = driver.current_url

        if answer_url == origin_url:
            print("Independent window opened, but URL did not change.", file=sys.stderr)
            return 1

        print(f"==> Detected URL change:")
        print(f"    from: {origin_url}")
        print(f"    to:   {answer_url}")

        status = wait.until(EC.presence_of_element_located((By.ID, "status")))
        wait.until(lambda d: "AI 預測完成" in status.text or "AI 預測失敗" in status.text)
        if "AI 預測失敗" in status.text:
            print(status.text, file=sys.stderr)
            return 1

        print("==> Waiting for AI prediction result in the answer window")
        wait.until(EC.text_to_be_present_in_element((By.ID, "prediction"), "AI 預測結果"))

        result_text = text_content(driver, "#prediction")
        print("==> AI prediction completed")
        print(unescape(result_text))
        return 0
    finally:
        if os.getenv("MISSIONCOOKIES_KEEP_BROWSER", "false").lower() != "true":
            time.sleep(2)
            driver.quit()
        else:
            print("==> Browser kept open because MISSIONCOOKIES_KEEP_BROWSER=true")


if __name__ == "__main__":
    raise SystemExit(main())
