#!/usr/bin/env node

// 内存配置测试脚本
const fs = require('fs');
const path = require('path');

console.log('🧪 测试3DPass区块监控系统内存配置...\n');

// 测试内存配置加载
function testMemoryConfigs() {
    try {
        const configPath = path.join(__dirname, 'memory-configs.json');
        const configData = fs.readFileSync(configPath, 'utf-8');
        const configs = JSON.parse(configData);
        
        console.log('✅ 内存配置文件加载成功');
        console.log(`   可用配置: ${Object.keys(configs).join(', ')}`);
        
        // 验证每个配置
        Object.entries(configs).forEach(([key, config]) => {
            console.log(`\n📋 验证配置: ${key}`);
            console.log(`   名称: ${config.name}`);
            console.log(`   后端最大内存: ${config.backend.maxMemoryMB}MB`);
            console.log(`   Web最大内存: ${config.web.maxMemoryMB}MB`);
            console.log(`   后端Node.js堆内存: ${config.backend.maxOldSpaceSize}MB`);
            console.log(`   Web Node.js堆内存: ${config.web.maxOldSpaceSize}MB`);
            
            // 验证配置完整性
            const requiredFields = ['maxMemoryMB', 'maxOldSpaceSize', 'gcThreshold', 'restartThreshold'];
            const backendValid = requiredFields.every(field => config.backend[field] !== undefined);
            const webValid = requiredFields.every(field => config.web[field] !== undefined);
            
            if (backendValid && webValid) {
                console.log('   ✅ 配置完整');
            } else {
                console.log('   ❌ 配置不完整');
            }
        });
        
        return true;
    } catch (error) {
        console.error('❌ 内存配置文件加载失败:', error.message);
        return false;
    }
}

// 测试PM2配置生成
function testPM2ConfigGeneration() {
    try {
        const { generatePM2Config } = require('./select-memory-config');
        const configs = require('./memory-configs.json');
        
        console.log('\n🔧 测试PM2配置生成...');
        
        // 测试每个配置的PM2配置生成
        Object.entries(configs).forEach(([key, config]) => {
            console.log(`\n📋 测试配置: ${key}`);
            const pm2Config = generatePM2Config(config);
            
            // 验证PM2配置结构
            if (pm2Config.apps && pm2Config.apps.length === 2) {
                console.log('   ✅ PM2配置结构正确');
                
                // 验证后端配置
                const backend = pm2Config.apps[0];
                if (backend.name === '3dp-block-monitor-app' && 
                    backend.max_memory_restart && 
                    backend.env.MEMORY_CONFIG) {
                    console.log('   ✅ 后端配置正确');
                } else {
                    console.log('   ❌ 后端配置错误');
                }
                
                // 验证Web配置
                const web = pm2Config.apps[1];
                if (web.name === '3dp-block-monitor-web' && 
                    web.max_memory_restart && 
                    web.env.MEMORY_CONFIG) {
                    console.log('   ✅ Web配置正确');
                } else {
                    console.log('   ❌ Web配置错误');
                }
            } else {
                console.log('   ❌ PM2配置结构错误');
            }
        });
        
        return true;
    } catch (error) {
        console.error('❌ PM2配置生成测试失败:', error.message);
        return false;
    }
}

// 测试内存守护进程
function testMemoryGuard() {
    try {
        console.log('\n🛡️ 测试内存守护进程...');
        
        const MemoryGuard = require('./memory-guard');
        
        // 测试默认配置
        const guard1 = new MemoryGuard();
        console.log(`   默认配置 - 最大内存: ${guard1.maxMemoryMB}MB`);
        
        // 测试自定义配置
        const guard2 = new MemoryGuard({
            maxMemoryMB: 500,
            checkInterval: 60000,
            gcThreshold: 0.8
        });
        console.log(`   自定义配置 - 最大内存: ${guard2.maxMemoryMB}MB`);
        console.log(`   自定义配置 - 检查间隔: ${guard2.checkInterval / 1000}秒`);
        console.log(`   自定义配置 - GC阈值: ${guard2.gcThreshold * 100}%`);
        
        // 测试内存获取
        const memory = guard1.getCurrentMemory();
        console.log(`   当前内存使用: ${memory.heapUsed}MB / ${memory.heapTotal}MB (${memory.percentage.toFixed(1)}%)`);
        
        console.log('   ✅ 内存守护进程测试通过');
        return true;
    } catch (error) {
        console.error('❌ 内存守护进程测试失败:', error.message);
        return false;
    }
}

// 测试当前ecosystem.config.js
function testCurrentEcosystemConfig() {
    try {
        console.log('\n📄 测试当前ecosystem.config.js...');
        
        const configPath = path.join(__dirname, 'ecosystem.config.js');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            // 使用require来加载配置文件，避免eval的安全问题
            delete require.cache[require.resolve(configPath)];
            const config = require(configPath);
            
            if (config.apps && config.apps.length === 2) {
                console.log('   ✅ ecosystem.config.js结构正确');
                
                const backend = config.apps[0];
                const web = config.apps[1];
                
                console.log(`   后端最大内存: ${backend.max_memory_restart}`);
                console.log(`   Web最大内存: ${web.max_memory_restart}`);
                console.log(`   后端Node.js参数: ${backend.node_args}`);
                console.log(`   Web Node.js参数: ${web.node_args}`);
                
                return true;
            } else {
                console.log('   ❌ ecosystem.config.js结构错误');
                return false;
            }
        } else {
            console.log('   ❌ ecosystem.config.js文件不存在');
            return false;
        }
    } catch (error) {
        console.error('❌ ecosystem.config.js测试失败:', error.message);
        return false;
    }
}

// 主测试函数
function runTests() {
    console.log('🚀 开始内存配置测试...\n');
    
    const tests = [
        { name: '内存配置加载', fn: testMemoryConfigs },
        { name: 'PM2配置生成', fn: testPM2ConfigGeneration },
        { name: '内存守护进程', fn: testMemoryGuard },
        { name: '当前配置文件', fn: testCurrentEcosystemConfig }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    tests.forEach(test => {
        try {
            if (test.fn()) {
                passed++;
            }
        } catch (error) {
            console.error(`❌ ${test.name}测试异常:`, error.message);
        }
    });
    
    console.log(`\n📊 测试结果: ${passed}/${total} 通过`);
    
    if (passed === total) {
        console.log('🎉 所有测试通过！内存配置系统工作正常。');
    } else {
        console.log('⚠️ 部分测试失败，请检查配置。');
    }
    
    return passed === total;
}

// 如果直接运行此脚本
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
