const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

// 性能测试：对比顺序插入 vs 随机插入
async function performanceTest() {
    console.log('🧪 SQLite插入性能测试开始...');
    
    // 测试数据量
    const testDataSize = 10000;
    
    // 生成测试数据
    const testData = [];
    for (let i = 1; i <= testDataSize; i++) {
        testData.push({
            id: i,
            timestamp: 1640995200 + i * 60, // 每分钟一个区块
            author: `test_author_${i}`,
            authorPublicKey: `0x${'0'.repeat(64)}`,
            blockhash: `0x${'0'.repeat(64)}`,
            difficult: Math.floor(Math.random() * 1000000),
            reward_amount: Math.floor(Math.random() * 1000000000)
        });
    }
    
    // ============ 测试1：顺序插入（优化方案） ============
    console.log('\n📈 测试1：顺序插入 + 大事务...');
    await testSequentialInsert(testData);
    
    // ============ 测试2：随机插入（当前问题） ============
    console.log('\n📉 测试2：随机插入 + 单个事务...');
    await testRandomInsert(testData);
    
    console.log('\n🎯 性能测试完成！');
}

// 测试顺序插入 + 大事务
async function testSequentialInsert(testData) {
    return new Promise((resolve, reject) => {
        const dbPath = './test_sequential.db';
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        
        const db = new sqlite3.Database(dbPath);
        const startTime = Date.now();
        
        db.serialize(() => {
            // 创建表
            db.run(`CREATE TABLE p3d_block_info (
                id INTEGER PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                author VARCHAR(50) NOT NULL,
                authorPublicKey VARCHAR(66),
                blockhash VARCHAR(66) NOT NULL,
                difficult BIGINT,
                reward_amount BIGINT
            )`);
            
            // 开始大事务
            db.run("BEGIN TRANSACTION");
            
            const stmt = db.prepare(`INSERT INTO p3d_block_info 
                (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`);
            
            // 顺序插入所有数据
            testData.forEach(item => {
                stmt.run([
                    item.id,
                    item.timestamp,
                    item.author,
                    item.authorPublicKey,
                    item.blockhash,
                    item.difficult,
                    item.reward_amount
                ]);
            });
            
            stmt.finalize();
            
            // 提交事务
            db.run("COMMIT", () => {
                const endTime = Date.now();
                const duration = endTime - startTime;
                console.log(`  ✅ 顺序插入耗时: ${duration}ms`);
                console.log(`  📊 平均每条记录: ${(duration / testData.length).toFixed(2)}ms`);
                
                db.close(() => {
                    resolve(duration);
                });
            });
        });
    });
}

// 测试随机插入 + 单个事务
async function testRandomInsert(testData) {
    return new Promise((resolve, reject) => {
        const dbPath = './test_random.db';
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
        
        const db = new sqlite3.Database(dbPath);
        const startTime = Date.now();
        
        // 创建表
        db.run(`CREATE TABLE p3d_block_info (
            id INTEGER PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            author VARCHAR(50) NOT NULL,
            authorPublicKey VARCHAR(66),
            blockhash VARCHAR(66) NOT NULL,
            difficult BIGINT,
            reward_amount BIGINT
        )`, () => {
            
            // 模拟随机插入：打乱数据顺序
            const shuffledData = [...testData];
            for (let i = shuffledData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledData[i], shuffledData[j]] = [shuffledData[j], shuffledData[i]];
            }
            
            let completedCount = 0;
            
            // 单个事务插入（模拟当前并行方式）
            shuffledData.forEach(item => {
                db.run(`INSERT INTO p3d_block_info 
                    (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                    [
                        item.id,
                        item.timestamp,
                        item.author,
                        item.authorPublicKey,
                        item.blockhash,
                        item.difficult,
                        item.reward_amount
                    ], 
                    function(err) {
                        if (err) {
                            console.error('插入失败:', err);
                        }
                        
                        completedCount++;
                        if (completedCount === shuffledData.length) {
                            const endTime = Date.now();
                            const duration = endTime - startTime;
                            console.log(`  ❌ 随机插入耗时: ${duration}ms`);
                            console.log(`  📊 平均每条记录: ${(duration / testData.length).toFixed(2)}ms`);
                            
                            db.close(() => {
                                resolve(duration);
                            });
                        }
                    }
                );
            });
        });
    });
}

// 清理测试文件
function cleanup() {
    const testFiles = ['./test_sequential.db', './test_random.db'];
    testFiles.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`🗑️ 清理测试文件: ${file}`);
        }
    });
}

// 运行测试
if (require.main === module) {
    performanceTest()
        .then(() => {
            console.log('\n🧹 清理测试文件...');
            cleanup();
        })
        .catch(error => {
            console.error('测试失败:', error);
            cleanup();
        });
}

module.exports = { performanceTest, cleanup }; 