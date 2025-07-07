# PM2进程管理使用说明

## 📋 概述

本项目已完善了PM2优雅关闭机制，支持SIGTERM信号处理，确保数据库连接和WebSocket连接得到正确清理。

## 🚀 启动应用

### 方式一：使用脚本启动（推荐）
```bash
# 启动所有服务
./pm2_start.sh

# 或者在Windows PowerShell中
.\pm2_start.sh
```

### 方式二：使用生态系统配置文件
```bash
# 启动所有应用
pm2 start ecosystem.config.js

# 仅启动区块监控器
pm2 start ecosystem.config.js --only 3dp-block-monitor-app

# 仅启动Web服务器
pm2 start ecosystem.config.js --only 3dp-block-monitor-web
```

### 方式三：手动启动
```bash
# 启动区块监控器
pm2 start npm --name "3dp-block-monitor-app" -- start

# 启动Web服务器
pm2 start npm --name "3dp-block-monitor-web" -- run web
```

## 🛑 停止应用

### 优雅停止（推荐）
```bash
# 停止所有应用
pm2 stop all

# 停止特定应用
pm2 stop 3dp-block-monitor-app
pm2 stop 3dp-block-monitor-web

# 停止并删除应用
pm2 delete all
pm2 delete 3dp-block-monitor-app
```

### 强制停止
```bash
# 强制停止所有应用
pm2 kill
```

## 🔄 重启应用

```bash
# 重启所有应用
pm2 restart all

# 重启特定应用
pm2 restart 3dp-block-monitor-app
pm2 restart 3dp-block-monitor-web

# 优雅重启（零停机时间）
pm2 reload all
```

## 📊 监控和日志

### 查看状态
```bash
# 查看所有应用状态
pm2 status

# 实时监控
pm2 monit
```

### 查看日志
```bash
# 查看所有日志
pm2 logs

# 查看特定应用日志
pm2 logs 3dp-block-monitor-app
pm2 logs 3dp-block-monitor-web

# 实时跟踪日志
pm2 logs --lines 50

# 清空日志
pm2 flush
```

### 日志文件位置
- 区块监控器日志：`./logs/app-*.log`
- Web服务器日志：`./logs/web-*.log`

## ⚙️ 优雅关闭机制

### 支持的信号
- **SIGTERM**: PM2发送的优雅关闭信号（默认）
- **SIGINT**: Ctrl+C发送的中断信号
- **SIGUSR2**: PM2重启时发送的信号

### 关闭超时设置
- **区块监控器**: 30秒关闭超时
- **Web服务器**: 10秒关闭超时

### 关闭流程
1. 收到信号，标记应用正在关闭
2. 停止新的请求处理
3. 清理实时监听资源（区块监控器）
4. 关闭WebSocket API连接
5. 关闭数据库连接
6. 安全退出进程

## 🔧 配置优化

### 内存限制
- **区块监控器**: 2GB内存限制，超出自动重启
- **Web服务器**: 1GB内存限制，超出自动重启

### 重启策略
- 异常退出后5秒重启（区块监控器）
- 异常退出后2秒重启（Web服务器）
- 最大重启次数：10次
- 最小运行时间：10秒（区块监控器）/ 5秒（Web服务器）

## 📝 常用命令总结

```bash
# 快速启动
./pm2_start.sh

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 优雅停止
pm2 stop all

# 重启应用
pm2 restart all

# 清理所有进程
pm2 delete all && pm2 kill
```

## 🚨 故障排除

### 应用无法启动
1. 检查配置文件：`node test-config.js`
2. 检查数据库文件是否存在
3. 检查端口是否被占用：`netstat -an | findstr 9070`

### 应用频繁重启
1. 查看错误日志：`pm2 logs 3dp-block-monitor-app --err`
2. 检查内存使用：`pm2 monit`
3. 检查网络连接状态

### 优雅关闭不工作
1. 检查PM2版本：`pm2 --version`
2. 查看关闭日志确认信号处理
3. 必要时使用 `pm2 kill` 强制停止

## ✅ 验证优雅关闭

启动应用后，使用以下命令测试优雅关闭：

```bash
# 启动应用
pm2 start ecosystem.config.js

# 发送SIGTERM信号测试
pm2 stop 3dp-block-monitor-app

# 查看日志确认优雅关闭信息
pm2 logs 3dp-block-monitor-app --lines 20
```

正常的优雅关闭日志应该包含：
- `📛 收到 SIGTERM 信号，正在关闭...`
- `🧹 清理实时监听资源...`
- `🔌 正在关闭API连接...`
- `🔒 正在关闭数据库连接...`
- `👋 系统已安全关闭` 