#!/usr/bin/env node

// SQLite数据库优化工具 - 类似MySQL的OPTIMIZE TABLE
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function optimizeDatabase() {
    console.log('🔧 SQLite数据库优化工具启动...\n');
    
    // 读取配置文件
    const configFile = process.argv[2] || "config.json";
    const configPath = path.resolve(__dirname, configFile);
    
    if (!fs.existsSync(configPath)) {
        console.error('❌ 配置文件不存在:', configPath);
        console.log('💡 用法: node optimize-database.js [config.json]');
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbPath = config.database?.path || './3dp_blocks.db';
    
    if (!fs.existsSync(dbPath)) {
        console.error('❌ 数据库文件不存在:', dbPath);
        process.exit(1);
    }
    
    console.log(`📂 数据库路径: ${dbPath}`);
    
    // 获取优化前的文件大小
    const originalStats = fs.statSync(dbPath);
    const originalSizeMB = (originalStats.size / 1024 / 1024).toFixed(2);
    console.log(`📏 优化前大小: ${originalSizeMB} MB\n`);
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        // 🔍 数据库分析
        console.log('🔍 数据库分析...');
        
        // 获取表信息
        const tableInfo = await analyzeDatabase(db);
        displayTableInfo(tableInfo);
        
        // 🛡️ 创建备份
        const backupPath = dbPath + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');
        console.log(`\n🛡️ 创建备份: ${path.basename(backupPath)}`);
        fs.copyFileSync(dbPath, backupPath);
        console.log('✅ 备份创建完成');
        
        // 📊 数据完整性检查
        console.log('\n📊 数据完整性检查...');
        const integrityResult = await checkDataIntegrity(db);
        if (!integrityResult.passed) {
            console.warn('⚠️ 发现数据完整性问题，建议先运行 --check-integrity');
        }
        
        // 🔧 开始优化
        console.log('\n🔧 开始数据库优化...');
        
        // 1. 分析表统计信息
        console.log('📈 分析表统计信息...');
        await executeQuery(db, 'ANALYZE');
        console.log('✅ 统计信息更新完成');
        
        // 2. 重建索引
        console.log('🔍 重建索引...');
        await rebuildIndexes(db);
        console.log('✅ 索引重建完成');
        
        // 3. 优化表结构（重新排序数据）
        console.log('📊 优化表数据排序...');
        await optimizeTableOrder(db);
        console.log('✅ 数据排序优化完成');
        
        // 4. 执行VACUUM压缩
        console.log('🗜️ 执行数据库压缩 (VACUUM)...');
        const vacuumStart = Date.now();
        await executeQuery(db, 'VACUUM');
        const vacuumTime = ((Date.now() - vacuumStart) / 1000).toFixed(1);
        console.log(`✅ 数据库压缩完成 (耗时: ${vacuumTime}秒)`);
        
        // 5. 优化配置
        console.log('⚡ 应用性能优化配置...');
        await applyOptimizationSettings(db);
        console.log('✅ 性能配置应用完成');
        
        // 📏 优化后统计
        console.log('\n📏 优化后统计...');
        const optimizedStats = fs.statSync(dbPath);
        const optimizedSizeMB = (optimizedStats.size / 1024 / 1024).toFixed(2);
        const sizeReduction = ((originalStats.size - optimizedStats.size) / originalStats.size * 100).toFixed(1);
        
        const finalTableInfo = await analyzeDatabase(db);
        
        console.log('\n🎉 数据库优化完成！');
        console.log('\n📊 优化结果:');
        console.log(`  📏 原始大小: ${originalSizeMB} MB`);
        console.log(`  📏 优化后大小: ${optimizedSizeMB} MB`);
        console.log(`  💾 节省空间: ${sizeReduction}% (${(originalStats.size - optimizedStats.size) / 1024 / 1024 > 0 ? '-' : '+'}${Math.abs((originalStats.size - optimizedStats.size) / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`  🔍 索引数量: ${finalTableInfo.indexCount} 个`);
        console.log(`  📊 数据页数: ${finalTableInfo.pageCount} 页`);
        
        console.log('\n✨ 优化效果:');
        console.log('  🚀 查询性能提升');
        console.log('  💾 存储空间优化');
        console.log('  🔍 索引效率改善');
        console.log('  📊 数据连续性改善');
        
        console.log('\n💡 优化建议:');
        console.log('  - 定期运行此工具（推荐每月一次）');
        console.log('  - 在数据增长较快时增加优化频率');
        console.log('  - 优化后重启应用程序以获得最佳性能');
        
        // 清理旧备份（保留最近5个）
        await cleanupOldBackups(dbPath);
        
    } catch (error) {
        console.error('\n❌ 数据库优化失败:', error.message);
        console.log('🛡️ 如需恢复，请使用备份文件');
        process.exit(1);
    } finally {
        db.close();
    }
}

// 分析数据库状态
async function analyzeDatabase(db) {
    const tableInfo = {};
    
    // 获取表记录数
    const blockCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM p3d_block_info', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
    
    // 获取KYC记录数
    const kycCount = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM p3d_kyc_info', (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
    
    // 获取数据库页数
    const pageInfo = await new Promise((resolve, reject) => {
        db.get('PRAGMA page_count', (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
    
    // 获取页大小
    const pageSize = await new Promise((resolve, reject) => {
        db.get('PRAGMA page_size', (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
    
    // 获取索引信息
    const indexes = await new Promise((resolve, reject) => {
        db.all("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    return {
        blockCount,
        kycCount,
        pageCount: pageInfo.page_count,
        pageSize: pageSize.page_size,
        indexCount: indexes.length,
        indexes: indexes.map(idx => idx.name)
    };
}

// 显示表信息
function displayTableInfo(info) {
    console.log(`  📊 区块数据: ${info.blockCount.toLocaleString()} 条记录`);
    console.log(`  🆔 KYC数据: ${info.kycCount.toLocaleString()} 条记录`);
    console.log(`  📄 数据页数: ${info.pageCount.toLocaleString()} 页`);
    console.log(`  📏 页大小: ${(info.pageSize / 1024).toFixed(0)} KB`);
    console.log(`  🔍 索引数量: ${info.indexCount} 个`);
    console.log(`  📂 总数据量: ${(info.pageCount * info.pageSize / 1024 / 1024).toFixed(2)} MB`);
}

// 数据完整性检查
async function checkDataIntegrity(db) {
    try {
        // 检查是否有缺失的区块
        const minMax = await new Promise((resolve, reject) => {
            db.get('SELECT MIN(id) as min_id, MAX(id) as max_id, COUNT(*) as count FROM p3d_block_info', (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (minMax.count === 0) {
            return { passed: true, message: '数据库为空' };
        }
        
        const expectedCount = minMax.max_id - minMax.min_id + 1;
        const actualCount = minMax.count;
        const missingCount = expectedCount - actualCount;
        
        if (missingCount === 0) {
            console.log('✅ 数据完整性良好：无缺失区块');
            return { passed: true, message: '数据完整' };
        } else {
            console.log(`⚠️ 发现 ${missingCount} 个缺失区块 (${(missingCount/expectedCount*100).toFixed(2)}%)`);
            return { passed: false, message: `缺失 ${missingCount} 个区块` };
        }
    } catch (error) {
        console.log('❌ 完整性检查失败:', error.message);
        return { passed: false, message: '检查失败' };
    }
}

// 重建索引
async function rebuildIndexes(db) {
    const indexes = [
        'DROP INDEX IF EXISTS idx_timestamp',
        'DROP INDEX IF EXISTS idx_author', 
        'DROP INDEX IF EXISTS idx_blockhash',
        'DROP INDEX IF EXISTS idx_kyc_author',
        'DROP INDEX IF EXISTS idx_kyc_block_height',
        'CREATE INDEX idx_timestamp ON p3d_block_info(timestamp)',
        'CREATE INDEX idx_author ON p3d_block_info(author)',
        'CREATE INDEX idx_blockhash ON p3d_block_info(blockhash)',
        'CREATE INDEX idx_kyc_author ON p3d_kyc_info(author)',
        'CREATE INDEX idx_kyc_block_height ON p3d_kyc_info(block_height)'
    ];
    
    for (const sql of indexes) {
        await executeQuery(db, sql);
    }
}

// 优化表数据排序（重新按主键排序）
async function optimizeTableOrder(db) {
    // 由于SQLite的特性，VACUUM会自动按主键重新排序数据
    // 这里我们确保数据按ID连续排列
    await executeQuery(db, 'CREATE TEMP TABLE temp_block_info AS SELECT * FROM p3d_block_info ORDER BY id');
    await executeQuery(db, 'DELETE FROM p3d_block_info');
    await executeQuery(db, 'INSERT INTO p3d_block_info SELECT * FROM temp_block_info');
    await executeQuery(db, 'DROP TABLE temp_block_info');
}

// 应用性能优化配置
async function applyOptimizationSettings(db) {
    const settings = [
        'PRAGMA journal_mode=WAL',
        'PRAGMA synchronous=NORMAL',
        'PRAGMA cache_size=10000',
        'PRAGMA temp_store=memory',
        'PRAGMA mmap_size=268435456', // 256MB
        'PRAGMA optimize'
    ];
    
    for (const setting of settings) {
        await executeQuery(db, setting);
    }
}

// 执行SQL查询
function executeQuery(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// 清理旧备份文件
async function cleanupOldBackups(dbPath) {
    try {
        const dir = path.dirname(dbPath);
        const baseName = path.basename(dbPath);
        const files = fs.readdirSync(dir);
        
        const backupFiles = files
            .filter(file => file.startsWith(baseName + '.backup-'))
            .map(file => ({
                name: file,
                path: path.join(dir, file),
                mtime: fs.statSync(path.join(dir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime); // 按时间倒序
        
        if (backupFiles.length > 5) {
            console.log('\n🧹 清理旧备份文件...');
            const toDelete = backupFiles.slice(5); // 保留最新的5个
            
            for (const backup of toDelete) {
                fs.unlinkSync(backup.path);
                console.log(`🗑️ 已删除旧备份: ${backup.name}`);
            }
            
            console.log(`✅ 保留最新的 ${Math.min(5, backupFiles.length)} 个备份文件`);
        }
    } catch (error) {
        console.log('⚠️ 清理备份文件失败:', error.message);
    }
}

// 主程序
if (require.main === module) {
    optimizeDatabase().catch(error => {
        console.error('💥 程序执行失败:', error);
        process.exit(1);
    });
}

module.exports = { optimizeDatabase }; 