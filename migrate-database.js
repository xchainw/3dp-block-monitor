#!/usr/bin/env node

// 数据库优化迁移脚本
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function migrateDatabase() {
    console.log('🔄 开始数据库优化迁移...\n');
    
    // 读取配置文件
    const configFile = process.argv[2] || "config.json";
    const configPath = path.resolve(__dirname, configFile);
    
    if (!fs.existsSync(configPath)) {
        console.error('❌ 配置文件不存在:', configPath);
        console.log('💡 请确保 config.json 文件存在');
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbPath = config.database?.path || './3dp_blocks.db';
    
    if (!fs.existsSync(dbPath)) {
        console.log('✅ 数据库文件不存在，无需迁移');
        process.exit(0);
    }
    
    console.log(`📂 数据库路径: ${dbPath}`);
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        // 1. 检查表是否存在
        await new Promise((resolve, reject) => {
            db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='p3d_block_info'`, (err, row) => {
                if (err) reject(err);
                else if (!row) {
                    console.log('✅ 表不存在，无需迁移');
                    process.exit(0);
                } else {
                    console.log('📊 找到现有表，开始迁移...');
                    resolve();
                }
            });
        });
        
        // 2. 检查表结构
        const columns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(p3d_block_info)`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('\n📋 当前表结构:');
        columns.forEach(col => {
            console.log(`  ${col.name}: ${col.type}`);
        });
        
        // 3. 检查是否需要迁移
        const needsMigration = columns.some(col => 
            (col.name === 'difficult' && col.type !== 'BIGINT') ||
            (col.name === 'reward_amount' && col.type !== 'BIGINT') ||
            (col.name === 'author' && col.type !== 'VARCHAR(50)') ||
            (col.name === 'authorPublicKey' && col.type !== 'VARCHAR(66)') ||
            (col.name === 'blockhash' && col.type !== 'VARCHAR(66)')
        );
        
        if (!needsMigration) {
            console.log('\n✅ 表结构已经是最新的，无需迁移');
            db.close();
            process.exit(0);
        }
        
        // 4. 获取数据总数
        const totalRows = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM p3d_block_info`, (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`\n📊 数据总数: ${totalRows} 条记录`);
        
        if (totalRows > 0) {
            console.log('\n⚠️  警告：即将进行数据库结构迁移');
            console.log('   这将备份现有数据并重建表结构');
            console.log('   建议先手动备份数据库文件');
            
            // 5. 创建备份
            const backupPath = dbPath + '.backup.' + Date.now();
            fs.copyFileSync(dbPath, backupPath);
            console.log(`📁 已创建备份: ${backupPath}`);
            
            // 6. 重命名现有表
            await new Promise((resolve, reject) => {
                db.run(`ALTER TABLE p3d_block_info RENAME TO p3d_block_info_old`, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('✅ 已重命名现有表');
                        resolve();
                    }
                });
            });
            
            // 7. 创建新表结构
            await new Promise((resolve, reject) => {
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
                    if (err) reject(err);
                    else {
                        console.log('✅ 已创建新表结构');
                        resolve();
                    }
                });
            });
            
            // 8. 迁移数据
            console.log('🔄 开始迁移数据...');
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO p3d_block_info 
                    (id, timestamp, author, authorPublicKey, blockhash, difficult, reward_amount, created_at)
                    SELECT 
                        id, 
                        timestamp, 
                        author, 
                        authorPublicKey, 
                        blockhash, 
                        CAST(difficult AS INTEGER) as difficult,
                        CAST(reward_amount AS INTEGER) as reward_amount,
                        created_at
                    FROM p3d_block_info_old`, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('✅ 数据迁移完成');
                        resolve();
                    }
                });
            });
            
            // 9. 验证迁移结果
            const newCount = await new Promise((resolve, reject) => {
                db.get(`SELECT COUNT(*) as count FROM p3d_block_info`, (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count);
                });
            });
            
            console.log(`📊 迁移后数据数量: ${newCount} 条记录`);
            
            if (newCount === totalRows) {
                console.log('✅ 数据迁移验证成功');
                
                // 10. 删除旧表
                await new Promise((resolve, reject) => {
                    db.run(`DROP TABLE p3d_block_info_old`, (err) => {
                        if (err) reject(err);
                        else {
                            console.log('🗑️ 已删除旧表');
                            resolve();
                        }
                    });
                });
            } else {
                console.error('❌ 数据迁移验证失败，数据数量不匹配');
                process.exit(1);
            }
        }
        
        // 11. 重建索引
        console.log('🔍 重建索引...');
        await Promise.all([
            new Promise((resolve, reject) => {
                db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON p3d_block_info(timestamp)`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }),
            new Promise((resolve, reject) => {
                db.run(`CREATE INDEX IF NOT EXISTS idx_author ON p3d_block_info(author)`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            }),
            new Promise((resolve, reject) => {
                db.run(`CREATE INDEX IF NOT EXISTS idx_blockhash ON p3d_block_info(blockhash)`, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            })
        ]);
        
        console.log('✅ 索引重建完成');
        
        // 12. 显示最终表结构
        const finalColumns = await new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(p3d_block_info)`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('\n📋 优化后的表结构:');
        finalColumns.forEach(col => {
            console.log(`  ${col.name}: ${col.type}`);
        });
        
        // 13. 计算存储空间优化
        const dbStats = fs.statSync(dbPath);
        console.log(`\n💾 数据库文件大小: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('\n🎉 数据库优化迁移完成！');
        console.log('\n📊 优化效果:');
        console.log('   - author: TEXT → VARCHAR(50)');
        console.log('   - authorPublicKey: TEXT → VARCHAR(66)');
        console.log('   - blockhash: TEXT → VARCHAR(66)');
        console.log('   - difficult: TEXT → BIGINT');
        console.log('   - reward_amount: TEXT → BIGINT');
        console.log('\n✨ 优势:');
        console.log('   - 🚀 更快的查询性能');
        console.log('   - 💾 更少的存储空间');
        console.log('   - 🔍 更好的索引效率');
        console.log('   - 📊 支持数值计算和排序');
        
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// 运行迁移
migrateDatabase().catch(console.error); 