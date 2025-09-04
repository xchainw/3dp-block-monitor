# 3DPass区块监控系统 - 内存优化配置使用指南

## 🚀 快速开始

### 1. 选择内存配置

根据您的服务器内存大小选择合适的配置：

```bash
# Linux/Mac 用户
chmod +x setup-memory-config.sh
./setup-memory-config.sh

# Windows 用户
setup-memory-config.bat

# 或者直接使用Node.js脚本
node select-memory-config.js 2g  # 选择2G内存配置
```

### 2. 启动服务

```bash
# 停止当前服务
pm2 stop all

# 启动新配置
pm2 start ecosystem.config.js

# 查看状态
pm2 list
```

## 📋 可用配置

| 配置 | 服务器内存 | 后端最大内存 | Web最大内存 | 适用场景 |
|------|------------|--------------|-------------|----------|
| 1g   | 1GB        | 200MB        | 100MB       | 小内存VPS |
| 2g   | 2GB        | 400MB        | 200MB       | 中等配置服务器 |
| 4g   | 4GB        | 800MB        | 400MB       | 高配置服务器 |
| 8g   | 8GB        | 1600MB       | 800MB       | 高性能服务器 |

## 🔧 配置详情

### 1G内存服务器 (1g)
- **后端应用**: 最大200MB，Node.js堆内存512MB
- **Web服务**: 最大100MB，Node.js堆内存256MB
- **特点**: 适合小内存VPS，仅运行基础监控功能

### 2G内存服务器 (2g)
- **后端应用**: 最大400MB，Node.js堆内存1024MB
- **Web服务**: 最大200MB，Node.js堆内存512MB
- **特点**: 平衡性能和内存使用，推荐配置

### 4G内存服务器 (4g)
- **后端应用**: 最大800MB，Node.js堆内存2048MB
- **Web服务**: 最大400MB，Node.js堆内存1024MB
- **特点**: 可处理大量数据，支持完整功能

### 8G内存服务器 (8g)
- **后端应用**: 最大1600MB，Node.js堆内存4096MB
- **Web服务**: 最大800MB，Node.js堆内存2048MB
- **特点**: 高性能配置，支持大量并发

## 🛠️ 管理命令

### 查看内存使用情况
```bash
# 查看详细内存状态
node check-memory.js

# 实时监控
pm2 monit

# 查看PM2进程状态
pm2 list
```

### 内存监控工具
```bash
# 查看当前内存状态
node memory-guard.js status

# 强制垃圾回收
node memory-guard.js gc

# 导出内存报告
node memory-guard.js report

# 开始实时监控
node memory-guard.js monitor
```

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

## 🔍 故障排除

### 内存使用过高
1. **检查当前配置是否适合服务器规格**
   ```bash
   node check-memory.js
   ```

2. **重启服务释放内存**
   ```bash
   pm2 restart all
   ```

3. **查看内存报告**
   ```bash
   node memory-guard.js report
   ```

### 频繁重启
1. **检查内存配置是否过于严格**
   - 查看当前配置: `node check-memory.js`
   - 考虑升级到更高配置

2. **查看应用日志**
   ```bash
   pm2 logs 3dp-block-monitor-app
   ```

### 性能问题
1. **根据服务器规格选择合适的配置**
   - 1G服务器: 使用 `1g` 配置
   - 2G服务器: 使用 `2g` 配置
   - 4G服务器: 使用 `4g` 配置

2. **调整batchSize参数**
   - 在 `config.json` 中减小 `batchSize` 值
   - 重启服务使配置生效

## 📊 监控指标

### 内存使用监控
- **RSS**: 物理内存使用量
- **堆内存**: Node.js堆内存使用量
- **外部内存**: 外部C++对象内存使用量
- **内存百分比**: 堆内存使用百分比

### 自动保护机制
- **GC触发**: 内存使用达到70%时自动触发垃圾回收
- **重启保护**: 内存使用达到90%时自动重启进程
- **趋势监控**: 检测内存增长趋势，提前预警

## 💡 优化建议

### 1G内存服务器
- 使用 `1g` 配置
- 禁用KYC处理: `--disable-kyc`
- 减小batchSize到10-20

### 2G内存服务器
- 使用 `2g` 配置
- 可以启用KYC处理
- batchSize设置为30-50

### 4G+内存服务器
- 使用 `4g` 或 `8g` 配置
- 启用所有功能
- batchSize可以设置更大

## 🔄 配置切换

如果需要切换内存配置：

1. **停止当前服务**
   ```bash
   pm2 stop all
   ```

2. **选择新配置**
   ```bash
   node select-memory-config.js 4g
   ```

3. **启动新配置**
   ```bash
   pm2 start ecosystem.config.js
   ```

4. **验证配置**
   ```bash
   node check-memory.js
   ```

## 📝 配置文件说明

- `memory-configs.json`: 内存配置文件，定义不同服务器规格的参数
- `ecosystem.config.js`: PM2配置文件，由选择脚本自动生成
- `memory-guard.js`: 内存守护进程，负责监控和限制内存使用
- `select-memory-config.js`: 配置选择脚本
- `check-memory.js`: 内存使用情况检查脚本

## 🆘 获取帮助

如果遇到问题：

1. 查看日志: `pm2 logs`
2. 检查内存状态: `node check-memory.js`
3. 查看内存报告: `node memory-guard.js report`
4. 重启服务: `pm2 restart all`

## 📈 性能监控

建议定期检查以下指标：

- 内存使用趋势
- 垃圾回收频率
- 进程重启次数
- 响应时间

使用 `pm2 monit` 可以实时查看这些指标。
