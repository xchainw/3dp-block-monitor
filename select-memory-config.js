#!/usr/bin/env node

// 内存配置选择脚本
const fs = require('fs');
const path = require('path');

// 加载内存配置
function loadMemoryConfigs() {
    try {
        const configPath = path.join(__dirname, 'memory-configs.json');
        const configData = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('❌ 无法加载内存配置文件:', error.message);
        process.exit(1);
    }
}

// 生成PM2配置文件
function generatePM2Config(memoryConfig) {
    const config = {
        apps: [
            {
                name: '3dp-block-monitor-app',
                script: 'block-monitor.js',
                node_args: memoryConfig.backend.nodeArgs,
                cwd: './',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: memoryConfig.pm2.backend.max_memory_restart,
                env: {
                    NODE_ENV: 'production',
                    NODE_OPTIONS: memoryConfig.backend.nodeArgs,
                    MEMORY_CONFIG: JSON.stringify(memoryConfig.backend)
                },
                time: true,
                merge_logs: true,
                kill_timeout: 30000,
                listen_timeout: 10000,
                restart_delay: 5000,
                max_restarts: memoryConfig.backend.maxRestarts,
                min_uptime: '10s',
                monitoring: true,
                memory_threshold: memoryConfig.pm2.backend.memory_threshold
            },
            {
                name: '3dp-block-monitor-web',
                script: 'web-server.js',
                node_args: memoryConfig.web.nodeArgs,
                cwd: './',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: memoryConfig.pm2.web.max_memory_restart,
                env: {
                    NODE_ENV: 'production',
                    PORT: 9070,
                    NODE_OPTIONS: memoryConfig.web.nodeArgs,
                    MEMORY_CONFIG: JSON.stringify(memoryConfig.web)
                },
                time: true,
                merge_logs: true,
                kill_timeout: 10000,
                listen_timeout: 5000,
                restart_delay: 2000,
                max_restarts: memoryConfig.web.maxRestarts,
                min_uptime: '5s',
                monitoring: true,
                memory_threshold: memoryConfig.pm2.web.memory_threshold
            }
        ]
    };
    
    return config;
}

// 显示配置信息
function showConfigInfo(configName, memoryConfig) {
    console.log(`\n📋 已选择配置: ${memoryConfig.name}`);
    console.log(`📝 描述: ${memoryConfig.description}`);
    console.log('\n🔧 后端应用配置:');
    console.log(`  最大内存: ${memoryConfig.backend.maxMemoryMB}MB`);
    console.log(`  Node.js堆内存: ${memoryConfig.backend.maxOldSpaceSize}MB`);
    console.log(`  GC阈值: ${memoryConfig.backend.gcThreshold * 100}%`);
    console.log(`  重启阈值: ${memoryConfig.backend.restartThreshold * 100}%`);
    console.log(`  检查间隔: ${memoryConfig.backend.checkInterval / 1000}秒`);
    
    console.log('\n🌐 Web服务配置:');
    console.log(`  最大内存: ${memoryConfig.web.maxMemoryMB}MB`);
    console.log(`  Node.js堆内存: ${memoryConfig.web.maxOldSpaceSize}MB`);
    console.log(`  GC阈值: ${memoryConfig.web.gcThreshold * 100}%`);
    console.log(`  重启阈值: ${memoryConfig.web.restartThreshold * 100}%`);
    console.log(`  检查间隔: ${memoryConfig.web.checkInterval / 1000}秒`);
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🔧 3DPass区块监控系统 - 内存配置选择工具\n');
        console.log('使用方法:');
        console.log('  node select-memory-config.js <配置名称>');
        console.log('\n可用配置:');
        console.log('  1g  - 1G内存服务器 (后端200MB, Web100MB)');
        console.log('  2g  - 2G内存服务器 (后端400MB, Web200MB)');
        console.log('  4g  - 4G内存服务器 (后端800MB, Web400MB)');
        console.log('  8g  - 8G内存服务器 (后端1600MB, Web800MB)');
        console.log('\n示例:');
        console.log('  node select-memory-config.js 2g');
        return;
    }
    
    const configName = args[0].toLowerCase();
    const configs = loadMemoryConfigs();
    
    if (!configs[configName]) {
        console.error(`❌ 未知的配置名称: ${configName}`);
        console.log('可用配置:', Object.keys(configs).join(', '));
        process.exit(1);
    }
    
    const memoryConfig = configs[configName];
    
    // 显示配置信息
    showConfigInfo(configName, memoryConfig);
    
    // 生成PM2配置
    const pm2Config = generatePM2Config(memoryConfig);
    
    // 保存配置文件
    const configPath = path.join(__dirname, 'ecosystem.config.js');
    const configContent = `module.exports = ${JSON.stringify(pm2Config, null, 2)};`;
    
    try {
        fs.writeFileSync(configPath, configContent);
        console.log(`\n✅ PM2配置文件已更新: ${configPath}`);
        
        // 注意: 配置文件已更新，建议在版本控制中提交更改
        
        console.log('\n🚀 下一步操作:');
        console.log('1. 停止当前服务: pm2 stop all');
        console.log('2. 启动新配置: pm2 start ecosystem.config.js');
        console.log('3. 查看状态: pm2 list');
        console.log('4. 监控内存: pm2 monit');
        
    } catch (error) {
        console.error('❌ 保存配置文件失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { loadMemoryConfigs, generatePM2Config };
