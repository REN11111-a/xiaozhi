@echo off
echo ========================================
echo   小智儿童启蒙机器人 - 启动中...
echo ========================================
echo.

cd backend

echo 安装依赖...
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple/

echo.
echo 启动服务器...
echo 打开浏览器访问 http://localhost:5000
echo.

python app.py

pause