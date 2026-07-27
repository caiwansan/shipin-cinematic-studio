#!/usr/bin/env python3
"""
BETA-06.7.1 Cookie Refresh Tool
从本地 Chrome 浏览器提取小红书 Cookies 并上传到昆仑镜

使用方法：
  1. 在本地 Chrome 浏览器登录 https://creator.xiaohongshu.com
  2. 运行: python3 refresh-xhs-cookies.py
  3. 脚本自动提取 cookies 并上传到 API

支持平台: macOS, Linux, Windows
"""

import json
import sys
import os
import base64
import sqlite3
import shutil
import tempfile
import platform
from datetime import datetime, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

# 配置
API_BASE = "https://aigc.fushtn.com"
API_ENDPOINT = "/api/enterprise/media-department/accounts/refresh-cookies"
ORGANIZATION_ID = "demo-org-001"
PLATFORM = "xiaohongshu"

# Chrome Cookie DB paths per OS
CHROME_PATHS = {
    "Darwin": [
        "~/Library/Application Support/Google Chrome/Default/Cookies",
        "~/Library/Application Support/Google Chrome/Profile*/Cookies",
        "~/Library/Application Support/Chromium/Default/Cookies",
    ],
    "Linux": [
        "~/.config/google-chrome/Default/Cookies",
        "~/.config/google-chrome/Profile*/Cookies",
        "~/.config/chromium/Default/Cookies",
    ],
    "Windows": [
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cookies"),
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Profile*\Cookies"),
    ],
}

# XHS domains to extract
XHS_DOMAINS = [
    ".xiaohongshu.com",
    "creator.xiaohongshu.com",
    "edith.xiaohongshu.com",
    "customer.xiaohongshu.com",
    "www.xiaohongshu.com",
]


def find_chrome_cookie_db():
    """Find Chrome cookie database file"""
    system = platform.system()
    paths = CHROME_PATHS.get(system, [])
    
    for pattern in paths:
        expanded = os.path.expanduser(pattern)
        # Handle glob patterns
        if '*' in expanded:
            import glob
            matches = glob.glob(expanded)
            for match in matches:
                if os.path.exists(match):
                    return match
        elif os.path.exists(expanded):
            return expanded
    
    return None


def extract_cookies(db_path):
    """Extract XHS cookies from Chrome SQLite DB"""
    # Chrome locks the DB, so copy it first
    tmp = tempfile.mktemp(suffix='.db')
    shutil.copy2(db_path, tmp)
    
    try:
        conn = sqlite3.connect(tmp)
        cursor = conn.cursor()
        
        # Chrome cookies table structure
        placeholders = ','.join(['?' for _ in XHS_DOMAINS])
        query = f"""
            SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly
            FROM cookies
            WHERE host_key LIKE '%xiaohongshu.com%'
            AND expires_utc > ?
            ORDER BY expires_utc DESC
        """
        
        # Current time in Chrome's timestamp format (microseconds since 1601-01-01)
        now_chrome = (datetime.utcnow() - datetime(1601, 1, 1)).total_seconds() * 1_000_000
        
        cursor.execute(query, (now_chrome,))
        rows = cursor.fetchall()
        
        cookies = []
        for host, name, value, path, expires_utc, secure, httponly in rows:
            # Filter to XHS domains only
            is_xhs = any(host.endswith(d) for d in XHS_DOMAINS)
            if not is_xhs:
                continue
                
            # Convert Chrome timestamp to Unix
            unix_expires = (expires_utc / 1_000_000) - 11644473600 if expires_utc > 0 else -1
            
            cookies.append({
                "name": name,
                "value": value,
                "domain": host if host.startswith('.') else f".{host}",
                "path": path,
                "expires": unix_expires if unix_expires > 0 else None,
                "httpOnly": bool(httponly),
                "secure": bool(secure),
                "sameSite": "Lax"
            })
        
        conn.close()
        return cookies
        
    finally:
        os.unlink(tmp)


def upload_cookies(cookies):
    """Upload cookies to 昆仑镜 API"""
    # Filter cookies with actual values
    valid = [c for c in cookies if c.get('value')]
    
    if not valid:
        print("❌ 未找到有效 Cookies。请先在 Chrome 登录小红书！")
        return False
    
    # Base64 encode
    cookie_json = json.dumps(valid, separators=(',', ':'))
    encoded = base64.b64encode(cookie_json.encode()).decode()
    
    print(f"📋 提取到 {len(valid)} 个有效 Cookies")
    print(f"📦 Base64 编码长度: {len(encoded)} chars")
    
    # Upload to API
    api_url = f"{API_BASE}{API_ENDPOINT}"
    payload = json.dumps({
        "organizationId": ORGANIZATION_ID,
        "platform": PLATFORM,
        "credentialType": "cookie_json",
        "encryptedPayload": encoded,
        "encryptionVersion": 1
    }).encode('utf-8')
    
    try:
        req = Request(api_url, data=payload, headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {os.environ.get("AIGC_TOKEN", "")}'
        })
        
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            
        if result.get('code') == 0:
            print(f"✅ Cookie 刷新成功！")
            vault_id = result.get('data', {}).get('vaultId', 'unknown')
            print(f"   Vault ID: {vault_id}")
            return True
        else:
            print(f"❌ API 返回错误: {result.get('message', 'unknown')}")
            return False
            
    except URLError as e:
        print(f"❌ 网络错误: {e}")
        return False


def main():
    print("=" * 50)
    print("BETA-06.7.1 XHS Cookie Refresh Tool")
    print("=" * 50)
    
    # Find Chrome
    db_path = find_chrome_cookie_db()
    if not db_path:
        print("❌ 未找到 Chrome Cookie 数据库！")
        print("   请确认 Chrome 已安装并使用过小红书")
        sys.exit(1)
    
    print(f"📁 Cookie DB: {db_path}")
    
    # Check Chrome is not running (locks the DB)
    # In practice, we copy the DB so it's usually fine
    
    # Extract cookies
    cookies = extract_cookies(db_path)
    print(f"🍪 提取到 {len(cookies)} 个 XHS Cookies")
    
    if not cookies:
        print("❌ 未找到小红书 Cookies！")
        print("   请在 Chrome 浏览器中登录 https://creator.xiaohongshu.com")
        print("   登录后重试此脚本")
        sys.exit(1)
    
    # Preview
    print("\n📋 Cookie 预览:")
    for c in cookies[:5]:
        print(f"  {c['name']}: {c['value'][:20]}... (domain: {c['domain']})")
    if len(cookies) > 5:
        print(f"  ... 共 {len(cookies)} 个")
    
    # Upload
    print(f"\n🚀 上传到 {API_BASE}...")
    success = upload_cookies(cookies)
    
    if not success:
        print("\n💡 提示: 也可以手动运行以下 curl 命令:")
        print('   curl -X POST https://aigc.fushtn.com/api/enterprise/media-department/accounts/refresh-cookies \\')
        print('     -H "Content-Type: application/json" \\')
        print('     -H "Authorization: Bearer YOUR_TOKEN" \\')
        print('     -d \'{"organizationId":"demo-org-001","platform":"xiaohongshu","credentialType":"cookie_json","encryptedPayload":"..."}\'')


if __name__ == "__main__":
    main()
