#!/data/data/com.termux/files/usr/bin/bash
# 배가스 계산기 실행: 폰 브라우저에서 http://localhost:8082 접속
cd "$(dirname "$0")"
python3 -m http.server 8082 --bind 127.0.0.1
