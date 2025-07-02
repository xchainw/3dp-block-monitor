@echo off
REM 3DPass区块监控系统启动脚本 (Windows版)
REM 优化内存设置，防止内存溢出

echo 🚀 启动3DPass区块监控系统（内存优化版）...

REM Node.js 内存和性能优化参数
set NODE_OPTIONS=--max-old-space-size=2048 --max-semi-space-size=128 --expose-gc --optimize-for-size --gc-interval=100

echo 📊 内存设置:
echo   最大堆内存: 2GB
echo   启用垃圾回收: 是
echo   优化模式: 内存优先

REM 检查配置文件
if not exist "config.json" (
    echo ⚠️ 配置文件不存在，从示例文件复制...
    copy config-example.json config.json >nul
)

REM 启动应用
echo 🔄 启动区块监控...
node block-monitor.js %*

REM 如果程序异常退出，暂停以便查看错误信息
if errorlevel 1 (
    echo.
    echo ❌ 程序异常退出，错误代码: %errorlevel%
    echo 💡 可能的解决方案:
    echo   1. 检查网络连接
    echo   2. 确认配置文件正确
    echo   3. 查看 error.log 日志
    echo.
    pause
) 