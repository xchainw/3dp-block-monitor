# 3DPass区块监控系统 - 项目文件清单

## 📁 核心应用文件

### 主要应用
- `block-monitor.js` - 主监控应用，负责同步区块链数据
- `web-server.js` - Web服务器，提供API和前端界面
- `ecosystem.config.js` - PM2配置文件 (已优化内存设置)

### 数据库相关
- `3dp_blocks.db` - SQLite数据库文件
- `3dp_blocks.db-shm` - SQLite共享内存文件
- `3dp_blocks.db-wal` - SQLite预写日志文件
- `optimize-database.js` - 数据库优化脚本

## 🛠️ 内存优化系统

### 配置文件
- `memory-configs.json` - 内存配置文件，定义不同服务器规格的参数
- `select-memory-config.js` - 内存配置选择脚本
- `memory-guard.js` - 内存守护进程，负责监控和限制内存使用

### 监控工具
- `check-memory.js` - 内存使用情况检查脚本
- `test-memory-config.js` - 配置测试脚本
- `memory-monitor.js` - 内存监控工具 (原有)

## 🚀 启动和管理脚本

### 快速设置
- `setup-memory-config.sh` - Linux/Mac快速设置脚本
- `setup-memory-config.bat` - Windows快速设置脚本
- `pm2_start.sh` - PM2启动脚本 (原有)
- `start.sh` - 启动脚本 (原有)
- `start.bat` - Windows启动脚本 (原有)

### 系统维护
- `cleanup-logs.js` - 日志清理工具
- `daily-check.sh` - 日常检查脚本 (原有)

## 📊 测试和调试工具

### 测试脚本
- `test-api.js` - API测试脚本 (原有)
- `test-config.js` - 配置测试脚本 (原有)
- `test-performance.js` - 性能测试脚本 (原有)
- `test-resumable.js` - 断点续传测试脚本 (原有)

### 修复工具
- `fix-missing-blocks.js` - 修复缺失区块脚本 (原有)
- `sync-kyc-info.js` - KYC信息同步脚本 (原有)

## 🌐 前端文件

### 静态资源
- `public/index.html` - 主页面
- `public/miner.html` - 矿工详情页面
- `public/main.js` - 主页面JavaScript
- `public/miner.js` - 矿工页面JavaScript
- `public/style.css` - 样式文件
- `public/3dpass-logo.png` - 3DPass标志

## 📋 配置文件

### 应用配置
- `config.json` - 主配置文件
- `config-example.json` - 配置文件示例
- `package.json` - Node.js包配置
- `package-lock.json` - 依赖锁定文件

### 系统配置
- `install_3dp_block_watchdog_service.sh` - 系统服务安装脚本 (原有)

## 📚 文档文件

### 使用指南
- `README.md` - 项目说明文档
- `QUICK-START.md` - 快速开始指南
- `MEMORY-OPTIMIZATION.md` - 内存优化详细指南
- `MEMORY-SETUP-README.md` - 内存设置使用说明
- `MEMORY-OPTIMIZATION-SUMMARY.md` - 内存优化完成总结
- `PROJECT-FILES.md` - 项目文件清单 (本文件)

### 其他文档
- `CHANGES.md` - 变更日志 (原有)
- `PM2-USAGE.md` - PM2使用说明 (原有)
- `WEB-DEMO.md` - Web演示说明 (原有)

## 🗂️ 日志文件

### 应用日志
- `error.log` - 错误日志文件
- `logs/` - 日志目录 (如果启用文件日志)

## 📦 依赖目录

### Node.js模块
- `node_modules/` - Node.js依赖包目录

## 🎯 文件分类

### 新增文件 (内存优化相关)
- `memory-configs.json`
- `select-memory-config.js`
- `memory-guard.js`
- `check-memory.js`
- `test-memory-config.js`
- `cleanup-logs.js`
- `setup-memory-config.sh`
- `setup-memory-config.bat`
- `MEMORY-OPTIMIZATION.md`
- `MEMORY-SETUP-README.md`
- `MEMORY-OPTIMIZATION-SUMMARY.md`
- `QUICK-START.md`
- `PROJECT-FILES.md`

### 修改文件
- `ecosystem.config.js` - 添加内存优化配置
- `block-monitor.js` - 集成内存守护进程
- `web-server.js` - 集成内存守护进程

### 原有文件 (未修改)
- 其他所有文件保持原有功能

## 🧹 清理建议

### 可定期清理的文件
- `error.log` - 错误日志文件
- `logs/*.log` - 各种日志文件
- `*.backup.*` - 备份文件 (已禁用自动创建)

### 不应删除的文件
- `3dp_blocks.db*` - 数据库文件
- `config.json` - 配置文件
- `package.json` - 包配置文件
- 所有 `.js` 脚本文件

## 📊 文件大小统计

使用 `node cleanup-logs.js --info` 可以查看当前磁盘使用情况。

## 🔄 版本控制建议

建议将以下文件加入版本控制：
- 所有 `.js` 脚本文件
- 所有 `.json` 配置文件
- 所有 `.md` 文档文件
- 所有 `.sh` 和 `.bat` 脚本文件

不建议加入版本控制的文件：
- `node_modules/` 目录
- `*.log` 日志文件
- `3dp_blocks.db*` 数据库文件
- 临时文件和备份文件
