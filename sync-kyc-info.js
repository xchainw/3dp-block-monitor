// 独立的KYC信息同步脚本
// 用于在区块同步完成后，一次性获取所有挖矿账号的最新KYC信息

const {ApiPromise, WsProvider, Keyring} = require('@polkadot/api');
const polkadotUtil = require("@polkadot/util");
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();

// 配置日志
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'kyc-sync.log' })
    ]
});

// 数据库实例
let db = null;

// 读取配置文件
function loadConfig() {
    try {
        const configPath = path.resolve(__dirname, 'config.json');
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        logger.error('Error loading config file:', error);
        return null;
    }
}

// 初始化数据库连接
function initDatabase(config) {
    return new Promise((resolve, reject) => {
        const dbPath = config.database?.path || './3dp_blocks.db';
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('数据库连接失败:', err);
                reject(err);
                return;
            }
            logger.info(`数据库连接成功: ${dbPath}`);
            resolve();
        });
    });
}

// 获取所有挖矿账号
function getAllMiners() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT DISTINCT author FROM p3d_block_info ORDER BY author`;
        
        db.all(sql, [], (err, rows) => {
            if (err) {
                logger.error('获取挖矿账号失败:', err);
                reject(err);
            } else {
                const authors = rows.map(row => row.author);
                logger.info(`找到 ${authors.length} 个不同的挖矿账号`);
                resolve(authors);
            }
        });
    });
}

// 获取账号的最新KYC信息
async function getAccountKyc(api, author) {
    try {
        const identity = await api.query.identity.identityOf(author);
        
        let discord = null;
        let display = null;
        
        if (identity.isSome) {
            const info = identity.unwrap().info;
            const additional = info.additional.toHuman();

            // 检查 discord 信息
            if (additional && additional[0] && additional[0][1] && additional[0][1]["Raw"]) {
                discord = additional[0][1]["Raw"];
            }

            // 检查 display 信息
            if (info.display.toHuman() && info.display.toHuman()["Raw"]) {
                display = info.display.toHuman()["Raw"];
            }
        }
        
        return { author, discord, display };
        
    } catch (error) {
        logger.debug(`获取账号 ${author} KYC信息失败:`, error.message);
        return { author, discord: null, display: null };
    }
}

// 保存KYC信息到数据库
function saveKycInfo(author, discord, display) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT OR REPLACE INTO p3d_kyc_latest 
            (author, discord, display, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
        
        db.run(sql, [author, discord, display], function(err) {
            if (err) {
                logger.error(`保存KYC信息失败 (作者 ${author}):`, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// 创建最新KYC信息表
function createKycLatestTable() {
    return new Promise((resolve, reject) => {
        const sql = `CREATE TABLE IF NOT EXISTS p3d_kyc_latest (
            author VARCHAR(50) PRIMARY KEY,
            discord VARCHAR(50),
            display VARCHAR(50),
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`;
        
        db.run(sql, (err) => {
            if (err) {
                logger.error('创建p3d_kyc_latest表失败:', err);
                reject(err);
            } else {
                logger.info('p3d_kyc_latest表已就绪');
                resolve();
            }
        });
    });
}

// 主函数
async function main() {
    try {
        logger.info('🚀 启动KYC信息同步工具...');
        
        // 加载配置
        const config = loadConfig();
        if (!config) {
            logger.error('配置文件加载失败');
            process.exit(1);
        }
        
        // 初始化数据库
        await initDatabase(config);
        await createKycLatestTable();
        
        // 连接到3DPass节点
        const rpcUrl = config['rpcUrl'] || "wss://rpc.3dpass.org";
        logger.info(`🔗 连接到节点: ${rpcUrl}`);
        
        const provider = new WsProvider(rpcUrl);
        const api = await ApiPromise.create({provider});
        logger.info('✅ API连接成功');
        
        // 获取所有挖矿账号
        const allMiners = await getAllMiners();
        
        if (allMiners.length === 0) {
            logger.info('没有找到挖矿账号');
            process.exit(0);
        }
        
        logger.info(`📊 开始同步 ${allMiners.length} 个账号的KYC信息...`);
        
        // 并发处理KYC信息（每批10个）
        const batchSize = 10;
        let processed = 0;
        let withKyc = 0;
        
        for (let i = 0; i < allMiners.length; i += batchSize) {
            const batch = allMiners.slice(i, i + batchSize);
            
            logger.info(`🔍 处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(allMiners.length/batchSize)} (${batch.length} 个账号)`);
            
            // 并发获取KYC信息
            const kycPromises = batch.map(author => getAccountKyc(api, author));
            const results = await Promise.allSettled(kycPromises);
            
            // 保存结果
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const {author, discord, display} = result.value;
                    await saveKycInfo(author, discord, display);
                    
                    processed++;
                    if (discord || display) {
                        withKyc++;
                        logger.info(`✅ ${author}: discord[${discord || 'null'}] display[${display || 'null'}]`);
                    }
                }
            }
            
            // 进度报告
            const progress = ((processed / allMiners.length) * 100).toFixed(1);
            logger.info(`📈 进度: ${processed}/${allMiners.length} (${progress}%) - 有KYC: ${withKyc}`);
            
            // 短暂延迟，避免API过载
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        logger.info('🎯 KYC信息同步完成！');
        logger.info(`📊 统计结果:`);
        logger.info(`  总账号数: ${allMiners.length}`);
        logger.info(`  有KYC信息: ${withKyc} (${((withKyc/allMiners.length)*100).toFixed(1)}%)`);
        logger.info(`  无KYC信息: ${allMiners.length - withKyc} (${(((allMiners.length - withKyc)/allMiners.length)*100).toFixed(1)}%)`);
        
        // 关闭连接
        await api.disconnect();
        db.close();
        
    } catch (error) {
        logger.error('❌ KYC同步失败:', error);
        process.exit(1);
    }
}

// 优雅退出处理
process.on('SIGINT', () => {
    logger.info('📛 收到退出信号，正在关闭...');
    if (db) {
        db.close();
    }
    process.exit(0);
});

// 启动应用
main().catch((error) => {
    logger.error('💥 应用启动失败:', error);
    process.exit(1);
}); 