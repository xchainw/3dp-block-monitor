#!/usr/bin/env node

// 配置测试脚本
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();



const configFile = process.argv[2] || "config.json";
const configFilePath = path.resolve(__dirname, configFile);

console.log('🔍 3DPass区块监控系统配置测试\n');

// 1. 测试配置文件
console.log('1️⃣ 测试配置文件...');
try {
    if (!fs.existsSync(configFilePath)) {
        console.error(`❌ 配置文件不存在: ${configFilePath}`);
        console.log('💡 请运行: cp config-example.json config.json');
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    console.log('✅ 配置文件加载成功');
    
    // 检查必要字段
    const requiredFields = ['rpcUrl'];
    for (const field of requiredFields) {
        if (!config[field]) {
            console.warn(`⚠️  缺少必要字段: ${field}`);
        }
    }
    
    console.log(`📡 RPC地址: ${config.rpcUrl}`);
    console.log(`📊 起始高度: ${config.startHeight || 0}`);
    console.log(`💾 数据库路径: ${config.database?.path || './3dp_blocks.db'}`);
    console.log(`📦 批次大小: ${config.database?.batchSize || 50}`);
    
} catch (error) {
    console.error('❌ 配置文件解析失败:', error.message);
    process.exit(1);
}

// 2. 测试数据库配置
console.log('\n2️⃣ 测试数据库配置...');
try {
    const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    const dbPath = config.database?.path || './3dp_blocks.db';
    
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ 数据库连接失败:', err.message);
            process.exit(1);
        }
        
        console.log('✅ 数据库连接成功');
        console.log(`📂 数据库路径: ${dbPath}`);
        
        // 测试创建表
        db.run(`CREATE TABLE IF NOT EXISTS p3d_block_info_test (
            id INTEGER PRIMARY KEY,
            test_field TEXT
        )`, (err) => {
            if (err) {
                console.error('❌ 创建测试表失败:', err);
            } else {
                console.log('✅ 数据库写入权限正常');
                
                // 清理测试表
                db.run('DROP TABLE IF EXISTS p3d_block_info_test');
            }
            
            db.close();
        });
    });
    
} catch (error) {
    console.error('❌ 数据库测试失败:', error.message);
}

// 3. 检查依赖
console.log('\n3️⃣ 检查依赖包...');
try {
    require('@polkadot/api');
    console.log('✅ @polkadot/api');
} catch (e) {
    console.error('❌ @polkadot/api 未安装');
}

try {
    require('sqlite3');
    console.log('✅ sqlite3');
} catch (e) {
    console.error('❌ sqlite3 未安装');
}

try {
    require('winston');
    console.log('✅ winston');
} catch (e) {
    console.error('❌ winston 未安装');
}

console.log('\n🎯 配置测试完成！');
console.log('\n📚 下一步操作：');
console.log('1. 修改 config.json 配置文件（RPC地址、起始高度等）');
console.log('2. 运行：node block-monitor.js');
console.log('3. 可选：运行 npm run test-api 测试API连接'); 