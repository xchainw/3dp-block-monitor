# 3DPass区块监控系统 - 内存优化配置指南

## 概述

本系统已针对不同内存大小的服务器进行了优化配置，支持1G、2G、4G等不同规格的服务器。

## 内存配置方案

### 1G内存服务器配置
- **后端应用**: 最大200MB，超过180MB自动重启
- **Web服务**: 最大100MB，超过80MB自动重启
- **Node.js堆内存**: 512MB (后端) / 256MB (Web)
- **适用场景**: 小内存VPS，仅运行基础监控功能

### 2G内存服务器配置
- **后端应用**: 最大400MB，超过360MB自动重启
- **Web服务**: 最大200MB，超过160MB自动重启
- **Node.js堆内存**: 1024MB (后端) / 512MB (Web)
- **适用场景**: 中等配置服务器，可运行完整功能

### 4G内存服务器配置
- **后端应用**: 最大800MB，超过720MB自动重启
- **Web服务**: 最大400MB，超过320MB自动重启
- **Node.js堆内存**: 2048MB (后端) / 1024MB (Web)
- **适用场景**: 高配置服务器，可运行所有功能并处理大量数据

## 使用方法

### 1. 选择内存配置
```bash
# 1G内存服务器
node select-memory-config.js 1g

# 2G内存服务器
node select-memory-config.js 2g

# 4G内存服务器
node select-memory-config.js 4g
```

### 2. 启动服务
```bash
# 使用PM2启动
pm2 start ecosystem.config.js

# 或使用脚本启动
./pm2_start.sh
```

### 3. 监控内存使用
```bash
# 查看内存使用情况
node check-memory.js

# 实时监控
pm2 monit

# 查看详细状态
pm2 show 3dp-block-monitor-app
pm2 show 3dp-block-monitor-web
```

## 内存优化特性

### 1. 自动内存监控
- 实时监控内存使用情况
- 自动触发垃圾回收
- 内存使用过高时自动重启

### 2. 智能垃圾回收
- 内存使用达到70%时触发GC
- 支持手动垃圾回收
- 优化GC参数减少停顿时间

### 3. 内存泄漏检测
- 监控内存增长趋势
- 检测异常内存增长
- 提供内存使用报告

## 配置文件说明

### ecosystem.config.js
PM2配置文件，包含不同内存配置的启动参数。

### memory-configs.json
内存配置文件，定义不同服务器规格的参数。

### memory-guard.js
内存守护进程，负责监控和限制内存使用。

## 故障排除

### 内存使用过高
1. 检查当前配置是否适合服务器规格
2. 重启PM2进程: `pm2 restart all`
3. 查看内存报告: `node memory-guard.js report`

### 频繁重启
1. 检查内存配置是否过于严格
2. 查看应用日志: `pm2 logs`
3. 考虑升级服务器配置

### 性能问题
1. 根据服务器规格选择合适的配置
2. 调整batchSize参数
3. 禁用不必要的功能（如KYC处理）

## 监控命令

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

## 注意事项

1. 选择配置前请确认服务器实际可用内存
2. 建议为系统和其他服务预留至少20%的内存
3. 定期检查内存使用报告，及时调整配置
4. 在高负载情况下，建议使用更高规格的配置