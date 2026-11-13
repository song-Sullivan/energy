#!/data/data/com.termux/files/usr/bin/bash
# NOx·CO 산소 환산 실행: 폰 브라우저에서 http://localhost:8083 접속
cd "$(dirname "$0")"
python3 -m http.server 8083 --bind 127.0.0.1
