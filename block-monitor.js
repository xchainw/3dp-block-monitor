// Import the API & Provider and some utility functions
const {ApiPromise, WsProvider, Keyring} = require('@polkadot/api');
const polkadotUtil = require("@polkadot/util");
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const {hideBin} = require("yargs/helpers");
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();

const colorized = winston.format.colorize();
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(info => colorized.colorize(info.level, `${info.timestamp} ${info.level}: ${info.message}`))
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'error.log', level: 'error'
        })
    ]
});
console.debug = logger.debug.bind(logger);
console.log = logger.info.bind(logger);
console.info = logger.info.bind(logger);
console.warn = logger.warn.bind(logger);
console.error = logger.error.bind(logger);

// Construct the keyring after the API (crypto has an async init)
const keyring = new Keyring({type: 'sr25519'});
// 3dp 格式
keyring.setSS58Format(71);

const argv = yargs(hideBin(process.argv))
    .option('config', {
        alias: 'c',
        type: 'string',
        default: 'config.json',
        description: '配置文件路径'
    })
    .option('check-integrity', {
        type: 'boolean',
        default: false,
        description: '仅执行数据完整性检查和补漏，不进行其他操作'
    })
    .option('fill-range', {
        type: 'string',
        description: '手动补漏指定范围的区块，格式: start-end 例如: 15095-15250'
    })
    .option('disable-kyc', {
        type: 'boolean',
        default: false,
        description: '禁用KYC信息处理以提高同步速度'
    })
    .help()
    .argv;

const configFile = argv.config;
// 配置文件路径
const configFilePath = path.resolve(__dirname, configFile);

// 数据库实例
let db = null;

// 内存中的KYC信息缓存 - 结构: { author: { discord: "xxx", display: "xxx" } }
// 缓存会反映账号的实时KYC状态，包括清空的情况（null值）
// p3d_kyc_info表记录所有KYC状态变化，包括首次出现和清空事件
let kycCache = new Map();

// 已在p3d_kyc_info表中有记录的账号集合
let recordedAccounts = new Set();

// 读取配置文件的函数
function loadConfig() {
    try {
        const fileContent = fs.readFileSync(configFilePath, 'utf-8');
        return JSON.parse(fileContent.toString());
    } catch (error) {
        console.error('Error loading config file:', error);
        return null;
    }
}

// 初始加载配置文件
let config = loadConfig();

// 监听配置文件的变化并重新加载配置，并更新全局变量
fs.watch(configFilePath, (eventType, filename) => {
    if(eventType === 'change') {
        console.log(`${filename} has changed, Reloading config...`)
        config = loadConfig();
        updateVariables();
    }
});

if (!config || Object.keys(config).length === 0) {
    console.error("config.json not found!");
    process.exit(-1);
}

// 全局变量
let startHeight = config['startHeight'] || 1;

// 更新全局变量
function updateVariables() {
    startHeight = config['startHeight'] || 1;
}

// 初始化SQLite数据库
function initDatabase() {
    return new Promise((resolve, reject) => {
        const dbPath = config.database?.path || './3dp_blocks.db';
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('数据库连接失败:', err);
                reject(err);
                return;
            }
            console.log(`数据库连接成功: ${dbPath}`);
            
            // 创建p3d_block_info表 - 优化后的数据类型
            db.run(`CREATE TABLE IF NOT EXISTS p3d_block_info (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                author VARCHAR(50) NOT NULL,
                authorPublicKey VARCHAR(66),
                blockhash VARCHAR(66) NOT NULL,
                difficult BIGINT,
                reward_amount BIGINT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    console.error('创建表失败:', err);
                    reject(err);
                } else {
                    console.log('p3d_block_info表已就绪');
                    
                    // 创建索引提高查询性能
                    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON p3d_block_info(timestamp)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_author ON p3d_block_info(author)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_blockhash ON p3d_block_info(blockhash)`);
                    
                    // 创建p3d_kyc_info表 - KYC历史记录表
                    db.run(`CREATE TABLE IF NOT EXISTS p3d_kyc_info (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        block_height INTEGER NOT NULL,
                        author VARCHAR(50) NOT NULL,
                        authorPublicKey VARCHAR(66),
                        discord VARCHAR(50),
                        display VARCHAR(50),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) {
                            console.error('创建KYC表失败:', err);
                            reject(err);
                        } else {
                            console.log('p3d_kyc_info表已就绪');
                            
                            // 创建KYC表索引
                            db.run(`CREATE INDEX IF NOT EXISTS idx_kyc_author ON p3d_kyc_info(author)`);
                            db.run(`CREATE INDEX IF NOT EXISTS idx_kyc_block_height ON p3d_kyc_info(block_height)`);
                            
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

// 保存KYC信息到数据库（记录所有KYC状态变化，包括首次出现和清空事件）
function saveKycInfo(blockHeight, author, authorPublicKey, discord, display) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO p3d_kyc_info 
            (block_height, author, authorPublicKey, discord, display) 
            VALUES (?, ?, ?, ?, ?)`;
        
        db.run(sql, [
            blockHeight,
            author,
            authorPublicKey,
            discord,
            display
        ], function(err) {
            if (err) {
                console.error(`保存KYC信息失败 (区块 #${blockHeight}, 作者 ${author}):`, err);
                reject(err);
            } else {
                console.log(`💾 保存KYC信息成功: 区块 #${blockHeight}, 作者 ${author}`);
                // 将账号添加到已记录集合中
                recordedAccounts.add(author);
                resolve(this.lastID);
            }
        });
    });
}

// 从数据库加载最新的KYC信息到内存缓存
function loadKycCacheFromDB() {
    return new Promise((resolve, reject) => {
        // 首先加载所有已记录的账号
        const accountsSql = `SELECT DISTINCT author FROM p3d_kyc_info`;
        
        db.all(accountsSql, [], (err, accountRows) => {
            if (err) {
                console.error('加载已记录账号失败:', err);
                reject(err);
                return;
            }
            
            // 填充已记录账号集合
            recordedAccounts.clear();
            accountRows.forEach(row => {
                recordedAccounts.add(row.author);
            });
            
            // 然后加载最新的KYC信息
            const kycSql = `
                SELECT author, discord, display
                FROM p3d_kyc_info k1
                WHERE k1.id = (
                    SELECT MAX(k2.id) 
                    FROM p3d_kyc_info k2 
                    WHERE k2.author = k1.author
                )
                ORDER BY author
            `;
            
            db.all(kycSql, [], (err, rows) => {
                if (err) {
                    console.error('加载KYC缓存失败:', err);
                    reject(err);
                } else {
                    kycCache.clear();
                    rows.forEach(row => {
                        kycCache.set(row.author, {
                            discord: row.discord,
                            display: row.display
                        });
                    });
                    console.log(`📋 加载KYC缓存完成: ${rows.length} 个账号的KYC信息`);
                    console.log(`📋 已记录账号数量: ${recordedAccounts.size} 个`);
                    resolve();
                }
            });
        });
    });
}

// 检查KYC信息是否需要记录（首次出现或状态变化）
function shouldRecordKyc(author, newDiscord, newDisplay) {
    // 如果账号从未记录过，则需要记录（无论KYC是否为空）
    if (!recordedAccounts.has(author)) {
        return true;
    }
    
    const cached = kycCache.get(author);
    
    // 如果缓存中没有此账号信息，但已记录过（数据异常情况），则需要记录
    if (!cached) {
        return true;
    }
    
    // 比较discord和display是否有变化
    return cached.discord !== newDiscord || cached.display !== newDisplay;
}

// 更新内存中的KYC缓存
function updateKycCache(author, discord, display) {
    kycCache.set(author, { discord, display });
}

// 保存区块信息到数据库（带去重）
function saveBlockInfo(blockData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT OR IGNORE INTO p3d_block_info 
            (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [
            blockData.height,
            blockData.timestamp,
            blockData.author,
            blockData.authorPublicKey,
            blockData.blockhash,
            // 转换为数值类型
            blockData.difficult ? parseInt(blockData.difficult) : null,
            blockData.reward_amount ? parseInt(blockData.reward_amount) : 0
        ], function(err) {
            if (err) {
                console.error(`保存区块 #${blockData.height} 失败:`, err);
                reject(err);
            } else {
                if (this.changes === 0) {
                    console.debug(`区块 #${blockData.height} 已存在，跳过`);
                } else {
                    console.log(`💾 保存区块 #${blockData.height} 成功`);
                }
                resolve(this.lastID);
            }
        });
    });
}

// 批量保存区块信息（大事务优化）
function batchSaveBlocksInfo(blockDataArray) {
    return new Promise((resolve, reject) => {
        if (!blockDataArray || blockDataArray.length === 0) {
            resolve([]);
            return;
        }
        
        console.log(`📦 开始批量保存 ${blockDataArray.length} 个区块...`);
        
        // 开始事务
        db.serialize(() => {
            db.run("BEGIN TRANSACTION", (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const sql = `INSERT OR IGNORE INTO p3d_block_info 
                    (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
                
                const stmt = db.prepare(sql);
                let successCount = 0;
                let errorCount = 0;
                
                // 批量插入
                blockDataArray.forEach((blockData, index) => {
                    stmt.run([
                        blockData.height,
                        blockData.timestamp,
                        blockData.author,
                        blockData.authorPublicKey,
                        blockData.blockhash,
                        blockData.difficult ? parseInt(blockData.difficult) : null,
                        blockData.reward_amount ? parseInt(blockData.reward_amount) : 0
                    ], function(err) {
                        if (err) {
                            console.error(`批量保存区块 #${blockData.height} 失败:`, err);
                            errorCount++;
                        } else {
                            if (this.changes > 0) {
                                successCount++;
                            }
                        }
                    });
                });
                
                stmt.finalize((err) => {
                    if (err) {
                        db.run("ROLLBACK", () => {
                            reject(err);
                        });
                        return;
                    }
                    
                    // 提交事务
                    db.run("COMMIT", (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            console.log(`✅ 批量保存完成: ${successCount} 个新区块, ${blockDataArray.length - successCount} 个已存在`);
                            resolve({
                                total: blockDataArray.length,
                                inserted: successCount,
                                skipped: blockDataArray.length - successCount,
                                errors: errorCount
                            });
                        }
                    });
                });
            });
        });
    });
}

// 获取数据库中最大的区块高度
function getMaxBlockHeight() {
    return new Promise((resolve, reject) => {
        db.get(`SELECT MAX(id) as maxHeight FROM p3d_block_info`, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row?.maxHeight || 0);
            }
        });
    });
}

// 获取数据库中缺失的区块范围
function getMissingBlocks(startHeight, endHeight) {
    return new Promise((resolve, reject) => {
        // 使用递归CTE查找缺失的区块ID
        const sql = `
            WITH RECURSIVE all_ids(id) AS (
                SELECT ? as id
                UNION ALL
                SELECT id + 1 FROM all_ids WHERE id < ?
            )
            SELECT id
            FROM all_ids
            WHERE id NOT IN (SELECT id FROM p3d_block_info)
            ORDER BY id
        `;
        
        db.all(sql, [startHeight, endHeight], (err, rows) => {
            if (err) {
                console.error('查询缺失区块失败:', err);
                reject(err);
            } else {
                const missingIds = rows.map(row => row.id);
                resolve(missingIds);
            }
        });
    });
}

// 获取缺失区块的连续范围
function getMissingBlockRanges(missingIds) {
    if (missingIds.length === 0) return [];
    
    const ranges = [];
    let rangeStart = missingIds[0];
    let rangeEnd = missingIds[0];
    
    for (let i = 1; i < missingIds.length; i++) {
        if (missingIds[i] === rangeEnd + 1) {
            // 连续的区块，扩展当前范围
            rangeEnd = missingIds[i];
        } else {
            // 不连续，保存当前范围并开始新范围
            ranges.push({ start: rangeStart, end: rangeEnd });
            rangeStart = missingIds[i];
            rangeEnd = missingIds[i];
        }
    }
    
    // 添加最后一个范围
    ranges.push({ start: rangeStart, end: rangeEnd });
    
    return ranges;
}

// 数据完整性检查
async function checkDataIntegrity(fromHeight, toHeight) {
    try {
        console.log(`🔍 检查数据完整性: #${fromHeight} 到 #${toHeight}`);
        
        // 查询缺失的区块
        const missingIds = await getMissingBlocks(fromHeight, toHeight);
        
        if (missingIds.length === 0) {
            console.log('✅ 数据完整性检查通过：无缺失区块');
            return { isComplete: true, missingBlocks: [], missingRanges: [] };
        }
        
        // 获取缺失区块的连续范围
        const missingRanges = getMissingBlockRanges(missingIds);
        
        console.log(`⚠️ 发现 ${missingIds.length} 个缺失区块：`);
        missingRanges.forEach(range => {
            if (range.start === range.end) {
                console.log(`  📍 缺失区块: #${range.start}`);
            } else {
                console.log(`  📍 缺失范围: #${range.start} - #${range.end} (${range.end - range.start + 1} 个区块)`);
            }
        });
        
        return { 
            isComplete: false, 
            missingBlocks: missingIds, 
            missingRanges: missingRanges 
        };
        
    } catch (error) {
        console.error('❌ 数据完整性检查失败:', error);
        throw error;
    }
}

// 带重试的单区块获取
async function fetchBlockDataWithRetry(api, height, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const blockData = await fetchBlockData(api, height);
            return blockData;
        } catch (error) {
            console.warn(`⚠️ 获取区块 #${height} 失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
            
            if (attempt === maxRetries) {
                console.error(`❌ 区块 #${height} 获取失败，已达最大重试次数`);
                throw error;
            }
            
            // 等待后重试，每次等待时间递增
            const waitTime = attempt * 2000; // 2秒、4秒、6秒...
            console.log(`⏳ 等待 ${waitTime/1000} 秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// 补漏缺失的区块数据
async function fillMissingBlocks(api, missingRanges) {
    if (!missingRanges || missingRanges.length === 0) {
        console.log('✅ 无需补漏：没有缺失的区块');
        return;
    }
    
    console.log(`🔧 开始补漏 ${missingRanges.length} 个缺失范围...`);
    
    let totalFilled = 0;
    let totalFailed = 0;
    
    for (const range of missingRanges) {
        const rangeSize = range.end - range.start + 1;
        console.log(`🔧 补漏范围: #${range.start}-${range.end} (${rangeSize} 个区块)`);
        
        const failedBlocks = [];
        const successBlocks = [];
        
        // 对于每个缺失范围，逐个区块处理（保证成功率）
        for (let height = range.start; height <= range.end; height++) {
            try {
                const blockData = await fetchBlockDataWithRetry(api, height);
                await saveBlockInfo(blockData);
                
                // 处理KYC信息
                if (!argv['disable-kyc']) {
                    try {
                        await processKycInfo(api, blockData.height, blockData.author, blockData.authorPublicKey, blockData.blockhash);
                    } catch (kycError) {
                        console.debug(`补漏时KYC处理失败 #${height}:`, kycError.message);
                    }
                }
                
                successBlocks.push(height);
                totalFilled++;
                
                console.log(`✅ 补漏区块 #${height} 成功`);
                
                // 每处理一个区块后短暂休息，避免过载
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ 补漏区块 #${height} 失败:`, error.message);
                failedBlocks.push(height);
                totalFailed++;
            }
        }
        
        console.log(`📊 范围 #${range.start}-${range.end} 补漏完成: 成功 ${successBlocks.length}/${rangeSize}, 失败 ${failedBlocks.length}`);
        
        if (failedBlocks.length > 0) {
            console.warn(`⚠️ 以下区块补漏失败: ${failedBlocks.join(', ')}`);
        }
        
        // 范围间短暂休息
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`🎯 补漏完成总计: 成功 ${totalFilled} 个, 失败 ${totalFailed} 个`);
    
    if (totalFailed > 0) {
        console.warn(`⚠️ 仍有 ${totalFailed} 个区块补漏失败，建议稍后再次运行程序进行重试`);
    }
}

// 处理单个区块信息（用于实时监听）
async function processBlock(api, height) {
    try {
        // 获取区块数据
        const blockData = await fetchBlockData(api, height);
        
        // 立即保存到数据库
        await saveBlockInfo(blockData);
        
        // 处理KYC信息
        if (!argv['disable-kyc']) {
            await processKycInfo(api, blockData.height, blockData.author, blockData.authorPublicKey, blockData.blockhash);
        }
        
        console.log(`💾 实时保存区块 #${height} 成功`);
        
        return blockData;
        
    } catch (error) {
        console.error(`处理区块 #${height} 失败:`, error);
        throw error;
    }
}

// 批量处理区块（内存优化版：防止内存溢出）
async function batchProcessBlocks(api, fromHeight, toHeight, batchSize = 50) {
    console.log(`📦 批量处理区块: ${fromHeight} 到 ${toHeight}`);
    
    // 🔧 内存优化：动态调整批次大小
    const maxMemoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (maxMemoryMB > 500) { // 超过500MB时减小批次
        batchSize = Math.min(batchSize, 20);
        console.log(`⚠️ 内存使用过高 (${maxMemoryMB.toFixed(1)}MB)，减小批次到 ${batchSize}`);
    }
    
    for (let i = fromHeight; i <= toHeight; i += batchSize) {
        const batchEnd = Math.min(i + batchSize - 1, toHeight);
        
        // 🧠 内存监控
        const memBefore = process.memoryUsage();
        console.log(`🔍 并发获取区块数据: ${i}-${batchEnd} (内存: ${(memBefore.heapUsed / 1024 / 1024).toFixed(1)}MB)`);
        
        try {
            // 阶段1：小批量并发获取（避免内存爆炸）
            const smallBatchSize = 10; // 进一步细分批次
            const allBlockData = [];
            
            for (let subStart = i; subStart <= batchEnd; subStart += smallBatchSize) {
                const subEnd = Math.min(subStart + smallBatchSize - 1, batchEnd);
                const promises = [];
                
                // 小批量并发获取
                for (let height = subStart; height <= subEnd; height++) {
                    promises.push(fetchBlockData(api, height));
                }
                
                const results = await Promise.allSettled(promises);
                
                // 立即处理结果，释放内存
                for (let j = 0; j < results.length; j++) {
                    const result = results[j];
                    const blockHeight = subStart + j;
                    
                    if (result.status === 'fulfilled' && result.value) {
                        allBlockData.push(result.value);
                    } else {
                        console.error(`获取区块 #${blockHeight} 失败:`, result.reason?.message || result.reason);
                        // 记录失败的区块，但不阻止继续处理
                    }
                }
                
                // 🗑️ 强制垃圾回收提示
                if (global.gc) {
                    global.gc();
                }
                
                // 短暂延迟，让系统回收内存
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 阶段2：按区块高度排序
            allBlockData.sort((a, b) => a.height - b.height);
            
            // 阶段3：批量写入数据库
            if (allBlockData.length > 0) {
                await batchSaveBlocksInfo(allBlockData);
                
                // 阶段4：批量处理KYC信息（并发优化）
                if (!argv['disable-kyc']) {
                    console.log(`🆔 批量并发处理KYC信息: ${allBlockData.length} 个区块`);
                    const kycStartTime = Date.now();
                    
                    // 并发处理KYC信息，每批最多10个并发
                    const kycConcurrency = 10;
                    for (let i = 0; i < allBlockData.length; i += kycConcurrency) {
                        const batch = allBlockData.slice(i, i + kycConcurrency);
                        const kycPromises = batch.map(blockData => 
                            processKycInfo(api, blockData.height, blockData.author, blockData.authorPublicKey, blockData.blockhash)
                                .catch(error => {
                                    console.debug(`KYC处理失败 #${blockData.height}:`, error.message);
                                    return null; // 不让单个失败影响整体
                                })
                        );
                        
                        // 等待当前批次完成
                        await Promise.allSettled(kycPromises);
                    }
                    
                    const kycDuration = Date.now() - kycStartTime;
                    console.log(`⚡ KYC并发处理完成: ${(kycDuration / 1000).toFixed(1)}秒`);
                } else {
                    console.log(`⏭️ 已禁用KYC处理，跳过 ${allBlockData.length} 个区块的KYC信息`);
                }
            }
            
            // 🧠 内存监控（处理后）
            const memAfter = process.memoryUsage();
            const memDiff = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
            
            console.log(`✅ 批次完成: ${i}-${batchEnd} (成功: ${allBlockData.length}/${batchEnd - i + 1})`);
            console.log(`   💾 内存变化: ${memDiff > 0 ? '+' : ''}${memDiff.toFixed(1)}MB (当前: ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB)`);
            
            // 🚨 内存警告检查
            if (memAfter.heapUsed / 1024 / 1024 > 800) {
                console.warn(`⚠️ 内存使用警告: ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB，建议重启程序`);
            }
            
            // 清理变量，帮助垃圾回收
            allBlockData.length = 0;
            
            // 延迟时间根据内存使用情况调整
            const delayTime = memAfter.heapUsed / 1024 / 1024 > 600 ? 3000 : 1000;
            await new Promise(resolve => setTimeout(resolve, delayTime));
            
        } catch (error) {
            console.error(`批次处理失败 ${i}-${batchEnd}:`, error);
            
            // 错误时强制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            // 发生错误时等待更长时间
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

// 获取单个区块数据（不写入数据库）
async function fetchBlockData(api, height) {
    try {
        const blockHash = await api.rpc.chain.getBlockHash(height);
        const header = await api.rpc.chain.getHeader(blockHash);
        
        // 修复：获取作者应该传入header.number而不是blockHash
        const author = await api.query.validatorSet.authors(header.number);
        
        // 修复：获取难度应该使用正确的API
        const difficulty = await api.query.difficulty.currentDifficulty.at(blockHash);
        
        // 修复：获取时间戳应该使用正确的API
        const timestampRaw = await api.query.timestamp.now.at(blockHash);
        const timestampMs = Number(timestampRaw.toString().trim());
        // 转换为Unix时间戳（秒）
        const timestamp = Math.floor(timestampMs / 1000);
        
        // 修复：转换作者地址为公钥使用正确的方法
        let authorPublicKey = '';
        try {
            authorPublicKey = polkadotUtil.u8aToHex(keyring.decodeAddress(author.toString()));
        } catch (e) {
            console.debug(`获取公钥失败 ${author.toString()}:`, e.message);
            authorPublicKey = '';
        }
        
        // 获取真实的区块奖励
        let reward_amount = '0';
        try {
            const blockEvents = (await api.query.system.events.at(blockHash)).toHuman();
            // 第一个 phase 为 Finalization 的元素，即是该区块发现者的奖励
            const firstFinalizationEvent = blockEvents.find(event => event.phase === 'Finalization');
            if (firstFinalizationEvent && firstFinalizationEvent.event.data.amount) {
                reward_amount = firstFinalizationEvent.event.data.amount.replace(/,/g, ''); // 移除千位分隔符
            }
        } catch (e) {
            console.debug(`获取区块奖励失败 #${height}:`, e.message);
            reward_amount = '0';
        }
        
        const blockData = {
            height: height,
            timestamp: timestamp,
            author: author.toString(),
            authorPublicKey: authorPublicKey,
            blockhash: blockHash.toString(),
            difficult: difficulty.toString(),
            reward_amount: reward_amount
        };
        
        // 输出详细的区块信息（调试用）
        console.debug(`📊 区块 #${height} 数据获取完成:`);
        console.debug(`  📅 时间: ${new Date(timestamp * 1000).toLocaleString()}`);
        console.debug(`  👤 作者: ${author.toString()}`);
        console.debug(`  🔧 难度: ${difficulty.toString()}`);
        console.debug(`  💰 奖励: ${reward_amount}`);
        
        return blockData;
        
    } catch (error) {
        console.error(`获取区块 #${height} 数据失败:`, error);
        throw error;
    }
}

// 处理KYC信息变化检查和保存
async function processKycInfo(api, blockHeight, author, authorPublicKey, blockHash) {
    try {
        // 获取KYC信息
        let discord = null;
        let display = null;
        
        // 创建历史 API 实例
        const apiAt = await api.at(blockHash);
        const identity = await apiAt.query.identity.identityOf(author.toString());
        
        // 检查是否有结果
        if (identity.isSome) {
            const info = identity.unwrap().info;
            const additional = info.additional.toHuman();

            // 检查 discord 信息是否存在且格式正确
            if (additional && additional[0] && additional[0][1] && additional[0][1]["Raw"]) {
                discord = additional[0][1]["Raw"];
            }

            // 检查 display 信息是否存在且格式正确
            if (info.display.toHuman() && info.display.toHuman()["Raw"]) {
                display = info.display.toHuman()["Raw"];
            }
        }
        
        // 检查是否需要记录KYC信息（首次出现或状态变化）
        if (shouldRecordKyc(author, discord, display)) {
            // 保存到数据库（记录所有KYC状态变化）
            await saveKycInfo(blockHeight, author, authorPublicKey, discord, display);
            
            const isFirstRecord = !recordedAccounts.has(author);
            const statusMsg = isFirstRecord ? '首次记录' : 'KYC变化';
            console.log(`🆔 ${statusMsg}: 区块 #${blockHeight}, 作者 ${author}, discord[${discord || 'null'}]|display[${display || 'null'}]`);
        }
        
        // 始终更新内存缓存（包括清空的情况）
        updateKycCache(author, discord, display);
        
    } catch (e) {
        console.debug(`处理KYC信息失败 #${blockHeight}:`, e.message);
    }
}

// 回填历史数据（支持断点续传）
async function backfillHistoricalBlocks(api) {
    try {
        console.log('🔄 开始历史数据回填...');
        
        // 获取当前最新区块高度
        const latestHeader = await api.rpc.chain.getHeader();
        const currentHeight = Number(latestHeader.number);
        
        // 获取数据库中已有的最大高度
        const dbMaxHeight = await getMaxBlockHeight();
        
        // 确定回填范围
        const actualStartHeight = Math.max(startHeight, dbMaxHeight + 1);
        
        // 📊 断点续传信息显示
        console.log('📊 断点续传检查:');
        console.log(`  🎯 配置起始高度: #${startHeight}`);
        console.log(`  💾 数据库最大高度: #${dbMaxHeight}`);
        console.log(`  🌐 网络最新高度: #${currentHeight}`);
        
        if (dbMaxHeight > 0) {
            const completedBlocks = dbMaxHeight - startHeight + 1;
            const totalBlocks = currentHeight - startHeight + 1;
            const completionPercentage = ((completedBlocks / totalBlocks) * 100).toFixed(2);
            
            console.log(`  ✅ 已完成: ${completedBlocks.toLocaleString()} 个区块`);
            console.log(`  📈 总进度: ${completionPercentage}% (${completedBlocks.toLocaleString()}/${totalBlocks.toLocaleString()})`);
            
            if (actualStartHeight <= currentHeight) {
                const remainingBlocks = currentHeight - actualStartHeight + 1;
                console.log(`  🔄 断点续传: 从 #${actualStartHeight} 继续，还需导入 ${remainingBlocks.toLocaleString()} 个区块`);
            }
        } else {
            console.log(`  🆕 首次运行: 将导入从 #${startHeight} 开始的所有区块`);
        }
        
        if (actualStartHeight > currentHeight) {
            console.log('📊 ✨ 历史数据已是最新，无需回填');
            return;
        }
        
        console.log(`\n📈 开始导入范围: #${actualStartHeight} 到 #${currentHeight}`);
        console.log(`📦 总计需导入: ${(currentHeight - actualStartHeight + 1).toLocaleString()} 个区块`);
        
        const batchSize = config.database?.batchSize || 50;
        const totalBatches = Math.ceil((currentHeight - actualStartHeight + 1) / batchSize);
        console.log(`🔢 批次设置: 每批 ${batchSize} 个区块，共 ${totalBatches} 批次\n`);
        
        // 记录开始时间
        const startTime = Date.now();
        
        await batchProcessBlocks(api, actualStartHeight, currentHeight, batchSize);
        
        // 计算耗时和性能统计
        const endTime = Date.now();
        const duration = endTime - startTime;
        const processedBlocks = currentHeight - actualStartHeight + 1;
        const blocksPerSecond = ((processedBlocks / duration) * 1000).toFixed(2);
        
        console.log('\n✅ 历史数据回填完成！');
        console.log(`📊 性能统计:`);
        console.log(`  ⏱️ 总耗时: ${(duration / 1000).toFixed(1)} 秒`);
        console.log(`  📦 处理区块: ${processedBlocks.toLocaleString()} 个`);
        console.log(`  🚀 处理速度: ${blocksPerSecond} 区块/秒`);
        
        // 最终状态检查
        const finalMaxHeight = await getMaxBlockHeight();
        const finalCompletionPercentage = (((finalMaxHeight - startHeight + 1) / (currentHeight - startHeight + 1)) * 100).toFixed(2);
        console.log(`  🎯 最终进度: ${finalCompletionPercentage}% (${finalMaxHeight.toLocaleString()}/${currentHeight.toLocaleString()})`);
        
        // 🔍 数据完整性检查和补漏
        console.log('\n🔍 开始数据完整性检查...');
        try {
            const integrityResult = await checkDataIntegrity(startHeight, currentHeight);
            
            if (!integrityResult.isComplete) {
                console.log('🔧 发现数据缺失，开始自动补漏...');
                await fillMissingBlocks(api, integrityResult.missingRanges);
                
                // 再次检查完整性
                console.log('🔍 补漏后再次检查数据完整性...');
                const recheckResult = await checkDataIntegrity(startHeight, currentHeight);
                
                if (recheckResult.isComplete) {
                    console.log('✅ 数据完整性修复成功：所有区块已完整');
                } else {
                    console.warn(`⚠️ 仍有 ${recheckResult.missingBlocks.length} 个区块未能修复`);
                }
            }
        } catch (integrityError) {
            console.error('❌ 数据完整性检查失败:', integrityError);
            console.log('⚠️ 跳过完整性检查，继续运行...');
        }
        
    } catch (error) {
        console.error('❌ 历史数据回填失败:', error);
        
        // 错误时也显示当前进度
        try {
            const currentMaxHeight = await getMaxBlockHeight();
            console.log(`💾 当前数据库最大高度: #${currentMaxHeight}`);
            console.log('🔄 下次启动将自动从此处继续导入');
        } catch (e) {
            console.error('获取当前进度失败:', e);
        }
        
        throw error;
    }
}

// 开始实时监听
async function startRealTimeMonitoring(api) {
    console.log('🔴 开始实时监听最新已确认的区块...');
    
    await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
        try {
            const latestBlockHeight = Number(header.number);
            console.log(`⛓️ 新区块: #${latestBlockHeight}`);
            
            // 处理新区块
            await processBlock(api, latestBlockHeight);
            
        } catch (error) {
            console.error('处理新区块失败:', error);
        }
    });
}

// 主函数
async function main() {
    try {
        console.log('🚀 启动3DPass区块监控系统...');
        
        // 初始化数据库
        await initDatabase();
        
        // 加载KYC缓存
        if (!argv['disable-kyc']) {
            console.log('📋 正在加载KYC缓存...');
            await loadKycCacheFromDB();
        } else {
            console.log('⏭️ KYC功能已禁用，跳过KYC缓存加载');
        }
        
        // 连接到3DPass节点
        const rpcUrl = config['rpcUrl'] || "wss://rpc.3dpass.org";
        console.log(`🔗 连接到节点: ${rpcUrl}`);
        
        const provider = new WsProvider(rpcUrl);
        const api = await ApiPromise.create({provider});
        
        console.log('✅ API连接成功');
        
        // 显示性能配置信息
        console.log('\n⚡ 性能配置总览:');
        if (argv['disable-kyc']) {
            console.log('  🆔 KYC处理: ❌ 已禁用 (性能优先模式)');
            console.log('  📈 预期速度: ~20-30秒/批次 (50个区块)');
        } else {
            console.log('  🆔 KYC处理: ✅ 已启用 (并发优化, 10个/批次)');
            console.log('  📈 预期速度: ~30-40秒/批次 (50个区块)');
            console.log('  💡 提示: 如需更快同步，可使用 --disable-kyc 参数');
        }
        console.log('');

        // 处理手动补漏指定范围
        if (argv['fill-range']) {
            const rangeParts = argv['fill-range'].split('-');
            if (rangeParts.length !== 2) {
                console.error('❌ 无效的范围格式，请使用: start-end 例如: 15095-15250');
                process.exit(1);
            }
            
            const startRange = parseInt(rangeParts[0]);
            const endRange = parseInt(rangeParts[1]);
            
            if (isNaN(startRange) || isNaN(endRange) || startRange > endRange) {
                console.error('❌ 无效的区块范围');
                process.exit(1);
            }
            
            console.log(`🔧 手动补漏区块范围: #${startRange} - #${endRange}`);
            
            const manualRanges = [{ start: startRange, end: endRange }];
            await fillMissingBlocks(api, manualRanges);
            
            console.log('✅ 手动补漏完成');
            process.exit(0);
        }
        
        // 处理仅检查完整性模式
        if (argv['check-integrity']) {
            console.log('🔍 数据完整性检查模式...');
            
            const dbMaxHeight = await getMaxBlockHeight();
            if (dbMaxHeight === 0) {
                console.log('📊 数据库为空，无需检查');
                process.exit(0);
            }
            
            console.log(`📊 检查范围: #${startHeight} - #${dbMaxHeight}`);
            
            const integrityResult = await checkDataIntegrity(startHeight, dbMaxHeight);
            
            if (!integrityResult.isComplete) {
                console.log('🔧 发现数据缺失，开始自动补漏...');
                await fillMissingBlocks(api, integrityResult.missingRanges);
                
                // 再次检查
                console.log('🔍 补漏后再次检查数据完整性...');
                const recheckResult = await checkDataIntegrity(startHeight, dbMaxHeight);
                
                if (recheckResult.isComplete) {
                    console.log('✅ 数据完整性修复成功：所有区块已完整');
                } else {
                    console.warn(`⚠️ 仍有 ${recheckResult.missingBlocks.length} 个区块未能修复`);
                }
            }
            
            console.log('✅ 完整性检查完成');
            process.exit(0);
        }
        
        // 🎯 两阶段导入策略：性能优化版
        console.log('📊 采用两阶段导入策略，优化SQLite插入性能...');
        
        // ========== 阶段一：历史数据顺序导入 ==========
        console.log('📈 阶段一：开始历史数据顺序导入...');
        try {
            await backfillHistoricalBlocks(api);
            console.log('✅ 阶段一完成：历史数据导入成功');
        } catch (error) {
            console.error('❌ 阶段一失败：历史数据导入失败:', error);
            // 即使历史数据导入失败，也继续进行实时监听
            console.log('⚠️ 跳过历史数据导入，直接进入实时监听...');
        }
        
        // ========== 阶段二：实时监听新区块 ==========
        console.log('🔴 阶段二：开始实时监听新区块...');
        try {
            await startRealTimeMonitoring(api);
            console.log('✅ 阶段二启动：实时监听已开启');
        } catch (error) {
            console.error('❌ 阶段二失败：实时监听启动失败:', error);
            throw error; // 实时监听失败则重启整个程序
        }
        
        console.log('🎯 系统运行正常，监听中...');
        
        // 保持程序运行（实时监听会持续运行）
        return new Promise(() => {}); // 永不resolve，保持程序运行
        
    } catch (error) {
        console.error('💥 系统启动失败:', error);
        
        // 10秒后重启
        console.log('⏰ 10秒后重启...');
        setTimeout(main, 10000);
    }
}

// 优雅退出处理
process.on('SIGINT', () => {
    console.log('📛 收到退出信号，正在关闭数据库连接...');
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

// 启动应用
main().catch((error) => {
    console.error('💥 应用启动失败:', error);
    process.exit(1);
});