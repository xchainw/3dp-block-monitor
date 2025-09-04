@echo off
chcp 65001 >nul

echo 🔧 3DPass区块监控系统 - 内存配置设置
echo ========================================

REM 检查Node.js是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查PM2是否安装
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到PM2，请先安装PM2
    echo 安装命令: npm install -g pm2
    pause
    exit /b 1
)

REM 显示可用配置
echo.
echo 📋 可用内存配置:
echo 1. 1g  - 1G内存服务器 (后端200MB, Web100MB)
echo 2. 2g  - 2G内存服务器 (后端400MB, Web200MB)
echo 3. 4g  - 4G内存服务器 (后端800MB, Web400MB)
echo 4. 8g  - 8G内存服务器 (后端1600MB, Web800MB)
echo.

REM 获取用户选择
set /p choice="请选择服务器内存配置 (1-4): "

if "%choice%"=="1" (
    set config=1g
) else if "%choice%"=="2" (
    set config=2g
) else if "%choice%"=="3" (
    set config=4g
) else if "%choice%"=="4" (
    set config=8g
) else (
    echo ❌ 无效选择，使用默认配置 (2g)
    set config=2g
)

echo.
echo 🔧 正在应用 %config% 配置...

REM 应用配置
node select-memory-config.js %config%

if %errorlevel% equ 0 (
    echo.
    echo ✅ 配置应用成功！
    echo.
    echo 🚀 下一步操作:
    echo 1. 停止当前服务: pm2 stop all
    echo 2. 启动新配置: pm2 start ecosystem.config.js
    echo 3. 查看状态: pm2 list
    echo 4. 监控内存: pm2 monit
    echo.
    echo 💡 其他有用的命令:
    echo   查看内存使用: node check-memory.js
    echo   内存监控: node memory-guard.js monitor
    echo   查看配置: type memory-configs.json
) else (
    echo ❌ 配置应用失败，请检查错误信息
)

pause
