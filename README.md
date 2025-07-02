# 3DPass区块数据收集系统

一个简洁高效的3DPass区块链数据收集系统，支持历史数据回填和实时区块监听，使用SQLite数据库存储完整的区块信息。

## 🚀 功能特性

### 数据收集
- **并行处理**: 同时进行历史数据回填和实时监听，确保数据完整性
- **数据去重**: 使用SQLite数据库约束自动去重，避免重复数据
- **断点续传**: 支持从上次中断的地方继续回填数据
- **批量处理**: 高效的并发处理机制，可配置批次大小
- **优雅退出**: 支持信号处理，安全关闭数据库连接
- **正确的API调用**: 参考官方示例修复了所有API使用错误
- **真实数据获取**: 从链上事件获取准确的区块奖励和时间戳

### Web界面
- **实时监控**: 24小时哈希率趋势图表，实时更新网络状态
- **矿工排名**: 今日爆块排名榜，显示矿工活跃度和占比
- **矿工详情**: 单个矿工的详细统计信息和历史数据
- **数据可视化**: 使用Chart.js绘制专业图表
- **响应式设计**: 支持桌面和移动设备访问
- **自动刷新**: 数据每30秒自动更新

## 📊 数据库结构

`p3d_block_info` 表字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INTEGER | 区块高度（主键） |
| timestamp | INTEGER | 区块Unix时间戳 |
| author | VARCHAR(50) | 区块作者地址 |
| authorPublicKey | VARCHAR(66) | 作者公钥地址 |
| blockhash | VARCHAR(66) | 区块哈希值 |
| difficult | BIGINT | 区块难度 |
| reward_amount | BIGINT | 区块奖励金额 |
| created_at | DATETIME | 记录创建时间 |

## 🛠️ 安装步骤

### 1. 克隆项目并安装依赖

```bash
git clone <project-url>
cd 3dp-block-monitor
npm install
```

### 2. 配置监控参数

复制并修改配置文件：

```bash
cp config-example.json config.json
# 编辑 config.json 文件
```

## ⚙️ 配置说明

### config.json 配置文件

```json
{
  "rpcUrl": "wss://rpc.3dpass.org",
  "startHeight": 0,
  "database": {
    "path": "./3dp_blocks.db",
    "batchSize": 50
  }
}
```

**字段说明：**

- `rpcUrl`: 3DPass节点RPC地址
- `startHeight`: 开始同步的区块高度（默认为0）
- `database.path`: SQLite数据库文件路径
- `database.batchSize`: 批量处理的区块数量



## 🏃‍♂️ 运行方式

### 🚀 数据收集

```bash
# 启动区块监控（后台数据收集）
node block-monitor.js
# 或者
npm start
```

### 🌐 Web界面

```bash
# 启动Web服务器（另开终端）
node web-server.js
# 或者
npm run web
```

然后打开浏览器访问：`http://localhost:3000`

### ⚙️ 指定配置文件

```bash
node block-monitor.js --config=my-config.json
# 或者
npm run monitor
```

### 🧪 测试系统

```bash
# 测试配置文件
npm run test-config

# 测试API连接
npm run test-api

# 性能对比测试
npm run test-performance

# 断点续传功能测试
npm run test-resumable

# 内存状态检查
npm run memory-status

# 数据库优化迁移（如果有现有数据）
npm run migrate-db
```

### 🔄 断点续传操作

#### 中断和恢复

**安全中断程序：**
```bash
# 方法1：使用 Ctrl+C（推荐）
Ctrl+C  # 触发优雅退出，安全关闭数据库连接

# 方法2：发送 SIGINT 信号
kill -SIGINT <进程PID>
```

**恢复导入：**
```bash
# 直接重启程序即可，无需任何额外操作
node block-monitor.js

# 程序会自动检测并显示断点续传信息：
📊 断点续传检查:
  🎯 配置起始高度: #0
  💾 数据库最大高度: #85432  ← 从这里继续
  🌐 网络最新高度: #1654321
  🔄 断点续传: 从 #85433 继续...
```

#### 查看导入进度

**实时监控：**
```bash
# 查看程序输出
tail -f ./error.log

# 查看数据库状态
sqlite3 ./3dp_blocks.db "
SELECT 
    MIN(id) as min_height,
    MAX(id) as max_height,
    COUNT(*) as total_blocks,
    printf('%.2f%%', (COUNT(*) * 100.0 / (SELECT MAX(id)))) as completion
FROM p3d_block_info;
"
```

**性能监控：**
```bash
# 程序运行时会显示：
📊 性能统计:
  ⏱️ 总耗时: 125.3 秒
  📦 处理区块: 2,500 个
  🚀 处理速度: 19.94 区块/秒
  🎯 最终进度: 15.23% (254,321/1,654,322)
```

### 🔧 数据完整性检查和补漏

#### 🔍 检查数据完整性

```bash
# 自动检查并补漏所有缺失数据
node block-monitor.js --check-integrity

# 或使用便捷工具
node fix-missing-blocks.js check
```

#### 🛠️ 手动补漏指定范围

```bash
# 补漏指定区块范围
node block-monitor.js --fill-range 15095-15250

# 或使用便捷工具
node fix-missing-blocks.js range 15095-15250
```

#### 📊 查找缺失区块

**使用SQL查询找出缺失的区块：**

```sql
-- 查找所有缺失的区块ID
WITH RECURSIVE all_ids(id) AS (
  SELECT 1
  UNION ALL
  SELECT id + 1 FROM all_ids WHERE id < (SELECT max(id) FROM p3d_block_info)
)
SELECT id
FROM all_ids
WHERE id NOT IN (SELECT id FROM p3d_block_info)
ORDER BY id;

-- 检查数据完整性
SELECT 
    COUNT(*) as current_blocks,
    MAX(id) as max_height,
    (MAX(id) - COUNT(*)) as missing_blocks
FROM p3d_block_info;
```

#### 🚨 常见问题处理

**问题1：发现数据缺失**
```bash
# 症状：COUNT(*) < MAX(id)
# 解决：运行完整性检查
node fix-missing-blocks.js check
```

**问题2：网络异常导致批量失败**
```bash
# 症状：大范围区块缺失
# 解决：手动补漏指定范围
node fix-missing-blocks.js range 起始区块-结束区块
```

**问题3：重启后程序跳过缺失区块**
```bash
# 症状：程序从最新区块继续，跳过中间缺失部分
# 解决：定期运行完整性检查
# 建议：设置定时任务每天检查一次
```

#### 🔄 预防性维护

**每日维护脚本示例：**
```bash
#!/bin/bash
# daily-check.sh
echo "开始每日数据完整性检查..."
node fix-missing-blocks.js check

# 如果有错误，发送邮件通知（可选）
if [ $? -ne 0 ]; then
    echo "数据完整性检查发现问题，请手动处理" | mail -s "3DPass数据监控告警" admin@domain.com
fi
```

**定时任务设置：**
```bash
# 编辑crontab
crontab -e

# 添加每天凌晨2点执行检查
0 2 * * * /path/to/3dp-block-monitor/daily-check.sh >> /path/to/3dp-block-monitor/check.log 2>&1
```

### 🔧 作为服务运行（Linux）

使用提供的安装脚本：

```bash
sudo ./install_3dp_block_watchdog_service.sh
```

查看服务状态：

```bash
sudo systemctl status 3dp.block.watchdog
sudo journalctl -u 3dp.block.watchdog -f
```

**服务管理：**
```bash
# 启动服务
sudo systemctl start 3dp.block.watchdog

# 停止服务（会触发优雅退出）
sudo systemctl stop 3dp.block.watchdog

# 重启服务（自动断点续传）
sudo systemctl restart 3dp.block.watchdog

# 查看服务日志
sudo journalctl -u 3dp.block.watchdog --since "1 hour ago" -f
```

## 📈 区块数据导入流程

### 🎯 两阶段导入策略（性能优化）

系统采用两阶段导入策略，显著提升SQLite数据库插入性能：

#### 🔄 阶段一：历史数据顺序导入

**特点：**
- 严格按区块高度顺序导入（避免B-Tree跳跃）
- 批量事务处理（将数千次插入合并为一次提交）
- 支持断点续传（中断后自动接续）
- 性能提升78倍！（测试：0.03ms/记录 vs 2.44ms/记录）

**断点续传机制：**
```bash
📊 断点续传检查:
  🎯 配置起始高度: #0
  💾 数据库最大高度: #85432
  🌐 网络最新高度: #1654321
  ✅ 已完成: 85,433 个区块
  📈 总进度: 5.16% (85,433/1,654,322)
  🔄 断点续传: 从 #85433 继续，还需导入 1,568,889 个区块
```

**性能优化细节：**
- **数据获取**：并发从区块链获取数据（50个区块/批次）
- **数据排序**：按区块高度排序确保顺序插入
- **批量写入**：使用大事务一次性写入数据库
- **错误恢复**：失败时显示进度，下次自动续传

#### ⚡ 阶段二：实时监听新区块

**特点：**
- 监听最新确认区块（Finalized Heads）
- 即时处理新区块（追加模式，性能最优）
- 自动去重（数据库约束防止重复）
- 永不停止（保持同步状态）

### 🚀 系统启动流程

1. **系统初始化**
   ```
   🚀 启动3DPass区块监控系统...
   💾 数据库连接成功: ./3dp_blocks.db
   🔗 连接到节点: wss://rpc.3dpass.org
   ✅ API连接成功
   ```

2. **阶段一：历史数据导入**
   ```
   📈 阶段一：开始历史数据顺序导入...
   📊 断点续传检查: [显示进度信息]
   📦 批次处理: 并发获取 + 顺序写入
   ✅ 阶段一完成：历史数据导入成功
   ```

3. **阶段二：实时监听**
   ```
   🔴 阶段二：开始实时监听新区块...
   ⛓️ 新区块: #1654322
   💾 实时保存区块 #1654322 成功
   🎯 系统运行正常，监听中...
   ```

### 💡 智能特性

**断点续传：**
- ✅ 程序中断后重启，自动从上次最大高度继续
- ✅ 显示详细进度信息（已完成/总进度/剩余区块）
- ✅ 性能统计（处理速度/耗时/完成率）
- ✅ 错误恢复时显示续传点

**容错机制：**
- ✅ 历史导入失败，仍继续实时监听
- ✅ 网络异常自动重连（10秒后重启）
- ✅ 优雅退出处理（Ctrl+C安全关闭数据库）
- ✅ 数据去重保护（INSERT OR IGNORE）

**性能监控：**
- ✅ 实时显示处理速度（区块/秒）
- ✅ 批次进度追踪
- ✅ 内存友好的批量处理
- ✅ 数据库性能优化（索引+数据类型优化）



## 🔍 数据查询示例

```sql
-- 查看最新10个区块
SELECT * FROM p3d_block_info ORDER BY id DESC LIMIT 10;

-- 查看指定地址的出块情况
SELECT * FROM p3d_block_info WHERE author = 'your-address' ORDER BY id DESC;

-- 统计每日出块数量
SELECT 
    DATE(timestamp, 'unixepoch') as date,
    COUNT(*) as block_count
FROM p3d_block_info 
GROUP BY DATE(timestamp, 'unixepoch')
ORDER BY date DESC;

-- 查看数据库统计信息
SELECT 
    MIN(id) as min_height,
    MAX(id) as max_height,
    COUNT(*) as total_blocks
FROM p3d_block_info;

-- 优化后支持的数值查询
-- 查询高难度区块（难度 > 50000000000000000）
SELECT id, author, difficult, reward_amount, 
       datetime(timestamp, 'unixepoch') as block_time
FROM p3d_block_info 
WHERE difficult > 50000000000000000 
ORDER BY difficult DESC 
LIMIT 10;

-- 统计不同奖励金额的分布
SELECT reward_amount, COUNT(*) as count
FROM p3d_block_info 
GROUP BY reward_amount 
ORDER BY reward_amount DESC;

-- 计算平均难度和总奖励
SELECT 
    AVG(difficult) as avg_difficulty,
    SUM(reward_amount) as total_rewards,
    COUNT(*) as total_blocks
FROM p3d_block_info;
```

## 🔧 故障排除

### ❓ 常见问题

**Q: 程序中断后如何恢复？**
A: 直接重启程序即可，系统会自动从数据库最大高度继续导入。

**Q: 如何查看当前导入进度？**
A: 查看程序输出日志，或使用SQL查询数据库状态：
```sql
SELECT MAX(id) as current_height, COUNT(*) as total_blocks FROM p3d_block_info;
```

**Q: 为什么导入速度很慢？**
A: 检查以下因素：
- 网络连接质量（到3DPass节点的延迟）
- 批次大小设置（database.batchSize，建议50-100）
- 系统资源（CPU/内存使用情况）

**Q: 数据库文件太大怎么办？**
A: 使用数据库迁移工具：
```bash
npm run migrate-db  # 优化数据类型，减少存储空间
```

**Q: 如何备份数据？**
A: 备份SQLite数据库文件：
```bash
# 停止程序
Ctrl+C

# 备份数据库
cp ./3dp_blocks.db ./backup/3dp_blocks_$(date +%Y%m%d).db

# 重启程序
node block-monitor.js
```

### 🚨 内存溢出问题

**问题描述：**
```
FATAL ERROR: JavaScript heap out of memory
```

**原因分析：**
- 长时间运行导致内存累积
- 批量处理过大，API响应数据累积在内存中
- Node.js默认内存限制不足

**解决方案：**

#### 1. 使用内存优化启动脚本

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

**启动脚本特点：**
- ✅ 自动设置2GB内存限制
- ✅ 启用垃圾回收功能
- ✅ 检查配置文件存在性
- ✅ 内存优化参数预设
- ✅ 错误信息友好提示

#### 2. 使用npm脚本启动

```bash
# 标准内存模式 (2GB) - 推荐
npm start

# 安全内存模式 (1GB) - 适合低配置机器
npm run start-safe

# 监控模式 - 带内存监控的启动
npm run monitor

# 手动设置内存 (高配置机器)
cross-env NODE_OPTIONS="--max-old-space-size=4096" node --expose-gc block-monitor.js
```

#### 3. 内存监控工具

```bash
# 查看当前内存状态
npm run memory-status

# 强制垃圾回收
npm run memory-gc

# 启动实时内存监控 (每分钟检查)
npm run memory-monitor
```

#### 4. 调整配置降低内存使用

**低内存配置 (config.json):**
```json
{
  "rpcUrl": "wss://rpc.3dpass.org",
  "startHeight": 0,
  "database": {
    "path": "./3dp_blocks.db",
    "batchSize": 20  ← 减小批次大小
  }
}
```

**推荐配置建议：**
- **高性能机器** (8GB+ RAM): `batchSize: 100`
- **标准机器** (4GB RAM): `batchSize: 50` (默认)
- **低配置机器** (2GB RAM): `batchSize: 20`
- **极低配置** (1GB RAM): `batchSize: 10`

#### 4. 内存监控和警告

程序现在包含内存监控功能：
```
🔍 并发获取区块数据: 55551-55600 (内存: 456.7MB)
✅ 批次完成: 55551-55600 (成功: 50/50)
   💾 内存变化: +12.3MB (当前: 469.0MB)
⚠️ 内存使用警告: 823.4MB，建议重启程序
```

#### 5. 预防措施

**系统级优化：**
```bash
# 增加系统交换空间
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 或者使用Docker限制内存
docker run --memory=2g your-app
```

**代码级优化：**
- ✅ 动态批次大小调整
- ✅ 小批量分段处理
- ✅ 自动垃圾回收
- ✅ 内存使用监控
- ✅ 延迟策略优化

### 🐛 错误处理

**网络连接错误：**
```
💥 系统启动失败: WebSocket connection failed
⏰ 10秒后重启...
```
- 检查网络连接
- 确认RPC节点地址正确
- 等待自动重启

**数据库错误：**
```
❌ 数据库连接失败: SQLITE_CANTOPEN
```
- 检查数据库文件路径权限
- 确保磁盘空间充足
- 检查config.json中database.path设置

**API调用错误：**
```
❌ 获取区块数据失败: RPC method not found
```
- 检查RPC节点版本兼容性
- 确认节点同步状态
- 尝试更换RPC节点地址

### 📊 性能优化建议

**提升导入速度：**
```json
{
  "database": {
    "batchSize": 100,  // 增加批次大小（适合高性能机器）
    "path": "/fast-disk/3dp_blocks.db"  // 使用SSD存储
  }
}
```

**降低资源占用：**
```json
{
  "database": {
    "batchSize": 20,   // 减少批次大小（适合低配置机器）
  }
}
```

**监控系统性能：**
```bash
# 查看磁盘I/O
iostat -x 1

# 查看内存使用
free -h

# 查看CPU使用
top -p $(pgrep -f block-monitor)
```

## 📈 高级配置

### 🎛️ 自定义配置

**大规模导入配置：**
```json
{
  "rpcUrl": "wss://rpc.3dpass.org",
  "startHeight": 0,
  "database": {
    "path": "/data/3dp_blocks.db",
    "batchSize": 200
  }
}
```

**资源受限配置：**
```json
{
  "rpcUrl": "wss://rpc.3dpass.org", 
  "startHeight": 1500000,
  "database": {
    "path": "./3dp_blocks.db",
    "batchSize": 10
  }
}
```

### 🔗 多节点配置

编辑配置文件使用备用节点：
```json
{
  "rpcUrl": "wss://rpc2.3dpass.org",  // 使用备用节点
  "startHeight": 0,
  "database": {
    "path": "./3dp_blocks.db",
    "batchSize": 50
  }
}
    SUM(reward_amount) as total_rewards,
    MIN(difficult) as min_difficulty,
    MAX(difficult) as max_difficulty
FROM p3d_block_info;
```

## 🌐 Web界面使用指南

### 主页功能

Web界面提供直观的数据可视化和实时监控功能：

#### 上半部分：网络状态概览
- **当前难度**: 最新区块的挖矿难度（自动除以1e12显示真实数值）
- **当前哈希率**: 基于难度计算的网络哈希率（难度/60，自动换算单位）
- **爆块奖励**: 每个区块的奖励金额（自动除以1e12显示真实数值）
- **今日矿工数**: 今天参与挖矿的矿工总数

#### 中间部分：哈希率趋势图
- 📈 **24小时哈希率折线图**: 按小时分组显示网络哈希率变化
- 🎨 **交互式图表**: 支持悬停查看详细数据点
- 🔄 **自动刷新**: 每30秒自动更新最新数据

#### 下半部分：今日爆块排名
实时显示从今天0点开始的矿工爆块排名：

| 列名 | 说明 |
|------|------|
| 排名 | 基于爆块数量的排名（前3名有特殊标色） |
| 地址 | 矿工地址（点击可跳转到详情页） |
| 爆块数 | 今天的总爆块数量 |
| 占比 | 在今天总爆块中的占比 |
| 最新高度 | 该矿工最后一个爆块的高度 |
| 最后爆块 | 距离最后爆块的时间（如：10m ago, 1h ago） |

### 矿工详情页

点击主页中的矿工地址可进入详情页面：

#### 上半部分：矿工统计
- **今日爆块**: 今天从0点开始的爆块数
- **本周爆块**: 最近7天的爆块数
- **本月爆块**: 最近30天的爆块数
- **总爆块数**: 该矿工的历史总爆块数

#### 中间部分：趋势图表
- 📊 **最近10天爆块柱状图**: 显示每天的爆块数量变化
- 📅 **完整数据**: 自动补齐缺失日期，显示为0

#### 下半部分：爆块记录
显示该矿工最近150个爆块的详细记录：

| 列名 | 说明 |
|------|------|
| 区块高度 | 爆块的具体高度 |
| 区块哈希 | 区块的哈希值（截取显示，悬停查看完整） |
| 爆块时间 | 爆块的具体日期时间 |

### API接口

Web界面提供RESTful API接口：

```bash
# 获取24小时哈希率数据
GET /api/hashrate/24h

# 获取当前网络统计
GET /api/current-stats

# 获取今日矿工排名
GET /api/today-miners

# 获取矿工统计信息
GET /api/miner/{address}/stats

# 获取矿工最近10天每日数据
GET /api/miner/{address}/daily

# 获取矿工最近150个爆块记录
GET /api/miner/{address}/blocks
```

### 数据更新说明

- **自动刷新**: 页面数据每30秒自动更新
- **手动刷新**: 点击"🔄 刷新"按钮立即更新
- **数据来源**: 直接从SQLite数据库读取，确保数据准确性
- **数值转换**: 难度和奖励金额自动除以1e12显示真实数值

## 🐛 故障排除

### 1. 数据库连接失败
- 检查数据库文件路径权限
- 确保SQLite3正确安装

### 2. RPC连接失败
- 检查网络连接
- 验证RPC节点地址是否正确
- 尝试其他RPC节点

### 3. 历史数据回填慢
- 调整`batchSize`参数
- 检查网络延迟
- 考虑使用更快的RPC节点

### 4. Web界面无法访问
- 确保Web服务器已启动：`npm run web`
- 检查端口3000是否被占用
- 确认数据库文件存在且可读
- 查看浏览器控制台错误信息

### 5. Web界面数据不显示
- 确认数据库中有数据：检查区块监控是否正常运行
- 查看Web服务器控制台错误日志
- 确认API接口返回正常：访问 http://localhost:3000/api/current-stats

## 🗃️ 数据库优化

### 优化的数据类型

系统已针对实际数据特征优化了数据库结构：

| 字段 | 优化前 | 优化后 | 说明 |
|------|--------|--------|------|
| author | TEXT | VARCHAR(50) | 3DPass地址固定长度约48字符 |
| authorPublicKey | TEXT | VARCHAR(66) | 公钥hex格式固定66字符 |
| blockhash | TEXT | VARCHAR(66) | 区块哈希固定66字符 |
| difficult | TEXT | BIGINT | 支持数值计算和排序 |
| reward_amount | TEXT | BIGINT | 支持数值计算和排序 |

### 优化效果

- 🚀 **查询性能提升**: 固定长度字段和数值类型提高索引效率
- 💾 **存储空间减少**: 更紧凑的数据存储
- 📊 **数值计算支持**: 可以直接对难度和奖励进行数学运算
- 🔍 **更好的排序**: 数值字段支持正确的数值排序

### 数据库迁移

如果您已有现有数据，可以使用迁移脚本升级：

```bash
# 备份现有数据库（推荐）
cp 3dp_blocks.db 3dp_blocks.db.backup

# 运行迁移脚本
npm run migrate-db

# 迁移脚本会：
# 1. 自动检测表结构
# 2. 创建数据库备份
# 3. 重建优化的表结构
# 4. 迁移所有现有数据
# 5. 验证数据完整性
```

## 📊 性能估算

150万区块数据存储需求（优化后）：
- **磁盘空间**: ~350-400MB（比优化前减少10-15%）
- **运行内存**: ~60-100MB
- **每日增长**: ~220KB（按1440个区块/天，优化后）
- **查询性能**: 提升20-30%

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## �� 许可证

ISC License 