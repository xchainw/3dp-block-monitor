#!/usr/bin/env node

// 3DPass区块链数据Web服务器
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接
let db = null;

// 初始化数据库连接
function initDatabase() {
    return new Promise((resolve, reject) => {
        const configFile = "config.json";
        const configPath = path.resolve(__dirname, configFile);
        
        if (!fs.existsSync(configPath)) {
            reject(new Error('配置文件不存在: config.json'));
            return;
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const dbPath = config.database?.path || './3dp_blocks.db';
        
        if (!fs.existsSync(dbPath)) {
            reject(new Error('数据库文件不存在: ' + dbPath));
            return;
        }
        
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                console.log(`📊 数据库连接成功: ${dbPath}`);
                resolve();
            }
        });
    });
}

// 工具函数：格式化哈希率
function formatHashrate(hashrate) {
    if (hashrate >= 1e12) {
        return (hashrate / 1e12).toFixed(2) + ' TH/s';
    } else if (hashrate >= 1e9) {
        return (hashrate / 1e9).toFixed(2) + ' GH/s';
    } else if (hashrate >= 1e6) {
        return (hashrate / 1e6).toFixed(2) + ' MH/s';
    } else if (hashrate >= 1e3) {
        return (hashrate / 1e3).toFixed(2) + ' KH/s';
    } else {
        return hashrate.toFixed(2) + ' H/s';
    }
}

// 工具函数：格式化时间差
function formatTimeAgo(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) {
        return diff + 's ago';
    } else if (diff < 3600) {
        return Math.floor(diff / 60) + 'm ago';
    } else if (diff < 86400) {
        return Math.floor(diff / 3600) + 'h ago';
    } else {
        return Math.floor(diff / 86400) + 'd ago';
    }
}

// 工具函数：获取今天开始的时间戳
function getTodayStart() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor(today.getTime() / 1000);
}

// 工具函数：获取指定天数前的时间戳
function getDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
}

// API: 获取最近24小时哈希率数据
app.get('/api/hashrate/24h', (req, res) => {
    const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 3600;
    
    const sql = `
        SELECT 
            timestamp,
            difficult / 1e12 as difficulty_real
        FROM p3d_block_info 
        WHERE timestamp >= ? 
        ORDER BY timestamp ASC
    `;
    
    db.all(sql, [twentyFourHoursAgo], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 按小时分组计算平均哈希率
        const hourlyData = {};
        rows.forEach(row => {
            const hour = Math.floor(row.timestamp / 3600) * 3600;
            if (!hourlyData[hour]) {
                hourlyData[hour] = { total: 0, count: 0 };
            }
            hourlyData[hour].total += row.difficulty_real / 60; // hashrate = difficulty / 60
            hourlyData[hour].count += 1;
        });
        
        const result = Object.keys(hourlyData).map(hour => ({
            timestamp: parseInt(hour),
            hashrate: hourlyData[hour].total / hourlyData[hour].count
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        res.json(result);
    });
});

// API: 获取当前状态信息
app.get('/api/current-stats', (req, res) => {
    const todayStart = getTodayStart();
    
    // 获取最新区块信息
    const latestSql = `
        SELECT 
            difficult / 1e12 as current_difficulty,
            reward_amount / 1e12 as block_reward
        FROM p3d_block_info 
        ORDER BY id DESC 
        LIMIT 1
    `;
    
    // 获取今天爆块人数
    const todayMinersSQL = `
        SELECT COUNT(DISTINCT author) as today_miners
        FROM p3d_block_info 
        WHERE timestamp >= ?
    `;
    
    db.get(latestSql, (err, latest) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        db.get(todayMinersSQL, [todayStart], (err, todayData) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const currentHashrate = latest ? latest.current_difficulty / 60 : 0;
            
            res.json({
                currentDifficulty: latest ? latest.current_difficulty : 0,
                currentHashrate: currentHashrate,
                currentHashrateFormatted: formatHashrate(currentHashrate),
                blockReward: latest ? latest.block_reward : 0,
                todayMiners: todayData ? todayData.today_miners : 0
            });
        });
    });
});

// API: 获取今天爆块排名
app.get('/api/today-miners', (req, res) => {
    const todayStart = getTodayStart();
    
    const sql = `
        SELECT 
            author,
            COUNT(*) as score,
            MAX(id) as last_height,
            MAX(timestamp) as last_time
        FROM p3d_block_info 
        WHERE timestamp >= ?
        GROUP BY author 
        ORDER BY score DESC, last_time DESC
    `;
    
    // 获取今天总爆块数
    const totalSql = `
        SELECT COUNT(*) as total_blocks
        FROM p3d_block_info 
        WHERE timestamp >= ?
    `;
    
    db.get(totalSql, [todayStart], (err, totalData) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const totalBlocks = totalData.total_blocks;
        
        db.all(sql, [todayStart], (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            const result = rows.map((row, index) => ({
                rank: index + 1,
                author: row.author,
                score: row.score,
                share: totalBlocks > 0 ? ((row.score / totalBlocks) * 100).toFixed(2) + '%' : '0%',
                lastHeight: row.last_height,
                lastTime: formatTimeAgo(row.last_time)
            }));
            
            res.json(result);
        });
    });
});

// API: 获取矿工详情统计
app.get('/api/miner/:address/stats', (req, res) => {
    const address = decodeURIComponent(req.params.address);
    console.debug('📊 查询矿工统计:', address);
    
    const todayStart = getTodayStart();
    const weekStart = getDaysAgo(7);
    const monthStart = getDaysAgo(30);
    
    // 今天爆块数
    const todaySql = `
        SELECT COUNT(*) as count
        FROM p3d_block_info 
        WHERE author = ? AND timestamp >= ?
    `;
    
    // 本周爆块数
    const weekSql = `
        SELECT COUNT(*) as count
        FROM p3d_block_info 
        WHERE author = ? AND timestamp >= ?
    `;
    
    // 本月爆块数
    const monthSql = `
        SELECT COUNT(*) as count
        FROM p3d_block_info 
        WHERE author = ? AND timestamp >= ?
    `;
    
    // 总爆块数
    const totalSql = `
        SELECT COUNT(*) as count
        FROM p3d_block_info 
        WHERE author = ?
    `;
    
    Promise.all([
        new Promise((resolve, reject) => {
            db.get(todaySql, [address, todayStart], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(weekSql, [address, weekStart], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(monthSql, [address, monthStart], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        }),
        new Promise((resolve, reject) => {
            db.get(totalSql, [address], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        })
    ]).then(([today, week, month, total]) => {
        res.json({
            today: today,
            week: week,
            month: month,
            total: total
        });
    }).catch(err => {
        res.status(500).json({ error: err.message });
    });
});

// API: 获取矿工最近10天每日爆块数据
app.get('/api/miner/:address/daily', (req, res) => {
    const address = decodeURIComponent(req.params.address);
    console.debug('📈 查询矿工每日数据:', address);
    
    const tenDaysAgo = getDaysAgo(10);
    
    const sql = `
        SELECT 
            DATE(timestamp, 'unixepoch') as date,
            COUNT(*) as blocks
        FROM p3d_block_info 
        WHERE author = ? AND timestamp >= ?
        GROUP BY DATE(timestamp, 'unixepoch')
        ORDER BY date ASC
    `;
    
    db.all(sql, [address, tenDaysAgo], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 确保返回最近10天的完整数据，缺失的日期补0
        const result = [];
        for (let i = 9; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const found = rows.find(row => row.date === dateStr);
            result.push({
                date: dateStr,
                blocks: found ? found.blocks : 0
            });
        }
        
        res.json(result);
    });
});

// API: 获取矿工最近150个爆块记录
app.get('/api/miner/:address/blocks', (req, res) => {
    const address = decodeURIComponent(req.params.address);
    console.debug('📋 查询矿工爆块记录:', address);
    
    const sql = `
        SELECT 
            id as height,
            blockhash,
            timestamp
        FROM p3d_block_info 
        WHERE author = ?
        ORDER BY id DESC 
        LIMIT 150
    `;
    
    db.all(sql, [address], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const result = rows.map(row => ({
            height: row.height,
            hash: row.blockhash,
            date: new Date(row.timestamp * 1000).toLocaleString('zh-CN')
        }));
        
        res.json(result);
    });
});

// 路由：主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：矿工详情页
app.get('/miner/:address', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'miner.html'));
});

// 启动服务器
async function startServer() {
    try {
        await initDatabase();
        
        app.listen(PORT, () => {
            console.log(`🌐 Web服务器启动成功: http://localhost:${PORT}`);
            console.log(`📊 主页: http://localhost:${PORT}`);
            console.log(`🔍 API文档: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
}

// 优雅退出
process.on('SIGINT', () => {
    console.log('\n📛 收到退出信号，正在关闭服务器...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库连接失败:', err);
            } else {
                console.log('✅ 数据库连接已关闭');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

startServer(); 