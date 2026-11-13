#!/data/data/com.termux/files/usr/bin/bash
# 온압보정 검산 실행: 폰 브라우저에서 http://localhost:8084 접속
cd "$(dirname "$0")"
python3 -m http.server 8084 --bind 127.0.0.1
