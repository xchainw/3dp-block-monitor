const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 测试断点续传功能
async function testResumableImport() {
    console.log('🧪 断点续传功能测试开始...\n');
    
    const testDbPath = './test_resumable.db';
    
    // 清理之前的测试文件
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
    
    try {
        // 阶段1：创建测试数据库并插入部分数据
        console.log('📝 阶段1：模拟首次导入...');
        await createTestDatabase(testDbPath);
        await insertTestBlocks(testDbPath, 1, 1000);
        
        let maxHeight = await getMaxBlockHeight(testDbPath);
        console.log(`  ✅ 首次导入完成，最大高度: #${maxHeight}`);
        
        // 阶段2：模拟程序重启，从断点继续
        console.log('\n🔄 阶段2：模拟断点续传...');
        console.log('  📊 断点续传检查:');
        console.log(`    💾 数据库最大高度: #${maxHeight}`);
        
        const resumeStartHeight = maxHeight + 1;
        console.log(`    🔄 应从 #${resumeStartHeight} 继续导入`);
        
        // 插入更多数据（模拟续传）
        await insertTestBlocks(testDbPath, resumeStartHeight, resumeStartHeight + 500);
        
        maxHeight = await getMaxBlockHeight(testDbPath);
        console.log(`  ✅ 断点续传完成，最大高度: #${maxHeight}`);
        
        // 阶段3：验证数据完整性
        console.log('\n🔍 阶段3：验证数据完整性...');
        const stats = await getDatabaseStats(testDbPath);
        
        console.log(`  📊 数据库统计:`);
        console.log(`    🔢 总区块数: ${stats.totalBlocks.toLocaleString()}`);
        console.log(`    📏 高度范围: #${stats.minHeight} - #${stats.maxHeight}`);
        console.log(`    🔗 连续性检查: ${stats.isSequential ? '✅ 连续' : '❌ 有缺失'}`);
        
        // 阶段4：测试重复导入的去重功能
        console.log('\n🛡️ 阶段4：测试数据去重功能...');
        const beforeCount = stats.totalBlocks;
        
        // 尝试重复插入相同数据
        await insertTestBlocks(testDbPath, 500, 600); // 重复插入已存在的区块
        
        const afterStats = await getDatabaseStats(testDbPath);
        console.log(`  📊 去重测试结果:`);
        console.log(`    导入前: ${beforeCount.toLocaleString()} 个区块`);
        console.log(`    导入后: ${afterStats.totalBlocks.toLocaleString()} 个区块`);
        console.log(`    去重效果: ${beforeCount === afterStats.totalBlocks ? '✅ 成功' : '❌ 失败'}`);
        
        console.log('\n🎯 断点续传功能测试完成！');
        
        if (stats.isSequential && beforeCount === afterStats.totalBlocks) {
            console.log('✅ 所有测试通过：断点续传和数据去重功能正常');
        } else {
            console.log('❌ 测试失败：发现功能异常');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        // 清理测试文件
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            console.log('🗑️ 清理测试文件');
        }
    }
}

// 创建测试数据库
function createTestDatabase(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.run(`CREATE TABLE p3d_block_info (
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
                reject(err);
            } else {
                // 创建索引
                db.run(`CREATE INDEX idx_timestamp ON p3d_block_info(timestamp)`);
                db.run(`CREATE INDEX idx_author ON p3d_block_info(author)`);
                db.close(() => resolve());
            }
        });
    });
}

// 插入测试区块数据
function insertTestBlocks(dbPath, startHeight, endHeight) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        console.log(`    📦 插入测试数据: #${startHeight} - #${endHeight}`);
        
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            const stmt = db.prepare(`INSERT OR IGNORE INTO p3d_block_info 
                (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`);
            
            for (let height = startHeight; height <= endHeight; height++) {
                stmt.run([
                    height,
                    1640995200 + height * 60, // 时间戳
                    `test_author_${height % 10}`, // 作者（循环）
                    `0x${'0'.repeat(64)}`, // 公钥
                    `0x${height.toString(16).padStart(64, '0')}`, // 区块哈希
                    Math.floor(Math.random() * 1000000), // 难度
                    Math.floor(Math.random() * 1000000000) // 奖励
                ]);
            }
            
            stmt.finalize();
            
            db.run("COMMIT", (err) => {
                db.close(() => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    });
}

// 获取数据库最大区块高度
function getMaxBlockHeight(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.get(`SELECT MAX(id) as maxHeight FROM p3d_block_info`, (err, row) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(row?.maxHeight || 0);
            }
        });
    });
}

// 获取数据库统计信息
function getDatabaseStats(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.all(`
            SELECT 
                MIN(id) as minHeight,
                MAX(id) as maxHeight,
                COUNT(*) as totalBlocks
            FROM p3d_block_info
        `, (err, rows) => {
            if (err) {
                db.close();
                reject(err);
                return;
            }
            
            const stats = rows[0];
            
            // 检查数据连续性
            db.get(`
                SELECT COUNT(*) as expectedCount 
                FROM (
                    SELECT id FROM p3d_block_info 
                    WHERE id BETWEEN ? AND ?
                ) 
            `, [stats.minHeight, stats.maxHeight], (err, row) => {
                db.close();
                
                if (err) {
                    reject(err);
                } else {
                    const expectedCount = stats.maxHeight - stats.minHeight + 1;
                    stats.isSequential = (row.expectedCount === expectedCount) && (stats.totalBlocks === expectedCount);
                    resolve(stats);
                }
            });
        });
    });
}

// 运行测试
if (require.main === module) {
    testResumableImport().catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
}

module.exports = { testResumableImport }; 