# 3DPass区块监控系统 - 快速开始指南

## 🚀 一键配置内存优化

### 方法1: 使用配置脚本 (推荐)

```bash
# Windows用户
setup-memory-config.bat

# Linux/Mac用户
chmod +x setup-memory-config.sh
./setup-memory-config.sh
```

### 方法2: 直接选择配置

```bash
# 选择1G内存配置 (适合小内存VPS)
node select-memory-config.js 1g

# 选择2G内存配置 (推荐)
node select-memory-config.js 2g

# 选择4G内存配置 (高性能)
node select-memory-config.js 4g

# 选择8G内存配置 (企业级)
node select-memory-config.js 8g
```

## 📋 配置对比表

| 服务器内存 | 配置名称 | 后端最大内存 | Web最大内存 | 适用场景 |
|------------|----------|--------------|-------------|----------|
| 1GB        | 1g       | 200MB        | 100MB       | 小内存VPS |
| 2GB        | 2g       | 400MB        | 200MB       | 推荐配置 |
| 4GB        | 4g       | 800MB        | 400MB       | 高性能服务器 |
| 8GB        | 8g       | 1600MB       | 800MB       | 企业级服务器 |

## 🔧 启动服务

```bash
# 1. 停止当前服务 (如果有)
pm2 stop all

# 2. 启动新配置
pm2 start ecosystem.config.js

# 3. 查看状态
pm2 list

# 4. 实时监控
pm2 monit
```

## 📊 监控内存使用

```bash
# 查看内存使用情况
node check-memory.js

# 查看当前内存状态
node memory-guard.js status

# 强制垃圾回收
node memory-guard.js gc

# 导出内存报告
node memory-guard.js report
```

## 🛠️ 常用命令

### 服务管理
```bash
# 重启服务
pm2 restart all

# 停止服务
pm2 stop all

# 查看日志
pm2 logs

# 查看特定服务日志
pm2 logs 3dp-block-monitor-app
pm2 logs 3dp-block-monitor-web
```

### 内存监控
```bash
# 实时内存监控
node memory-guard.js monitor

# 查看内存趋势
node check-memory.js

# 测试配置
node test-memory-config.js
```

### 系统维护
```bash
# 查看磁盘使用情况
node cleanup-logs.js --info

# 清理日志文件
node cleanup-logs.js --logs

# 清理备份文件
node cleanup-logs.js --backups

# 清理所有文件
node cleanup-logs.js --all
```

## 🔍 故障排除

### 内存使用过高
1. 检查当前配置: `node check-memory.js`
2. 重启服务: `pm2 restart all`
3. 查看内存报告: `node memory-guard.js report`

### 频繁重启
1. 检查配置是否适合服务器规格
2. 查看日志: `pm2 logs`
3. 考虑升级到更高配置

### 性能问题
1. 根据服务器内存选择合适的配置
2. 调整config.json中的batchSize参数
3. 使用`--disable-kyc`参数禁用KYC处理

## 📈 性能优化建议

### 1G内存服务器
- 使用 `1g` 配置
- 禁用KYC处理: `--disable-kyc`
- 减小batchSize到10-20

### 2G内存服务器
- 使用 `2g` 配置 (推荐)
- 可以启用KYC处理
- batchSize设置为30-50

### 4G+内存服务器
- 使用 `4g` 或 `8g` 配置
- 启用所有功能
- batchSize可以设置更大

## 🎯 最佳实践

1. **选择合适的配置**: 根据服务器实际内存选择配置
2. **定期监控**: 使用 `pm2 monit` 监控内存使用
3. **及时调整**: 根据使用情况调整配置
4. **备份配置**: 配置更改前备份原始文件
5. **测试验证**: 使用 `node test-memory-config.js` 验证配置

## 📞 获取帮助

如果遇到问题，可以：

1. 查看详细文档: `MEMORY-OPTIMIZATION.md`
2. 运行测试: `node test-memory-config.js`
3. 检查内存状态: `node check-memory.js`
4. 查看PM2状态: `pm2 list`

## 🎉 完成！

现在您的3DPass区块监控系统已经配置了内存优化，可以更稳定地运行在您的服务器上！
