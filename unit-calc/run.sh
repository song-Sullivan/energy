#!/data/data/com.termux/files/usr/bin/bash
# 연료 원단위 실행: 폰 브라우저에서 http://localhost:8085 접속
cd "$(dirname "$0")"
python3 -m http.server 8085 --bind 127.0.0.1
