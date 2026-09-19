#!/bin/bash
# 纸片拳王 PAPER FIST · 双击启动本地服务器并打开游戏
cd "$(dirname "$0")"
PORT=8777
(sleep 1 && open "http://127.0.0.1:$PORT/index.html") &
python3 -m http.server $PORT
