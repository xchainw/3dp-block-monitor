#!/usr/bin/env node

// 内存使用情况检查脚本
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 检查3DPass区块监控系统内存使用情况...\n');

// 加载当前内存配置
function loadCurrentConfig() {
    try {
        const configPath = path.join(__dirname, 'memory-configs.json');
        const configData = fs.readFileSync(configPath, 'utf-8');
        const configs = JSON.parse(configData);
        
        // 尝试从ecosystem.config.js中读取当前配置
        const ecosystemPath = path.join(__dirname, 'ecosystem.config.js');
        if (fs.existsSync(ecosystemPath)) {
            const ecosystemContent = fs.readFileSync(ecosystemPath, 'utf-8');
            
            // 简单的配置检测
            if (ecosystemContent.includes('"max_memory_restart": "200M"')) {
                return { name: '1g', config: configs['1g'] };
            } else if (ecosystemContent.includes('"max_memory_restart": "400M"')) {
                return { name: '2g', config: configs['2g'] };
            } else if (ecosystemContent.includes('"max_memory_restart": "800M"')) {
                return { name: '4g', config: configs['4g'] };
            } else if (ecosystemContent.includes('"max_memory_restart": "1600M"')) {
                return { name: '8g', config: configs['8g'] };
            }
        }
        
        return { name: 'unknown', config: null };
    } catch (error) {
        console.error('⚠️ 无法加载内存配置:', error.message);
        return { name: 'unknown', config: null };
    }
}

// 显示当前配置信息
const currentConfig = loadCurrentConfig();
if (currentConfig.config) {
    console.log(`📋 当前内存配置: ${currentConfig.config.name} (${currentConfig.name})`);
    console.log(`   后端最大内存: ${currentConfig.config.backend.maxMemoryMB}MB`);
    console.log(`   Web最大内存: ${currentConfig.config.web.maxMemoryMB}MB`);
    console.log(`   后端Node.js堆内存: ${currentConfig.config.backend.maxOldSpaceSize}MB`);
    console.log(`   Web Node.js堆内存: ${currentConfig.config.web.maxOldSpaceSize}MB`);
    console.log('');
}

// 检查PM2进程状态
exec('pm2 list', (error, stdout, stderr) => {
    if (error) {
        console.error('❌ 无法获取PM2进程信息:', error.message);
        return;
    }
    
    console.log('📊 PM2进程状态:');
    console.log(stdout);
    
    // 检查详细内存使用情况
    exec('pm2 show 3dp-block-monitor-app', (error, stdout, stderr) => {
        if (!error) {
            console.log('\n🔍 后端应用详细信息:');
            console.log(stdout);
        }
        
        exec('pm2 show 3dp-block-monitor-web', (error, stdout, stderr) => {
            if (!error) {
                console.log('\n🌐 Web服务详细信息:');
                console.log(stdout);
            }
            
            // 检查系统内存使用情况
            exec('free -h', (error, stdout, stderr) => {
                if (!error) {
                    console.log('\n💻 系统内存使用情况:');
                    console.log(stdout);
                }
                
                // 检查Node.js进程内存使用
                exec('ps aux | grep node | grep -v grep', (error, stdout, stderr) => {
                    if (!error && stdout.trim()) {
                        console.log('\n🟢 Node.js进程内存使用:');
                        console.log('PID\t\t%MEM\tRSS\t\tCOMMAND');
                        console.log(stdout);
                    }
                    
                    // 提供优化建议
                    console.log('\n💡 内存优化建议:');
                    console.log('1. 如果内存使用过高，可以重启PM2进程: pm2 restart all');
                    console.log('2. 查看实时内存监控: pm2 monit');
                    console.log('3. 查看详细日志: pm2 logs');
                    console.log('4. 如果内存持续增长，考虑减小batchSize配置');
                    console.log('5. 使用内存守护进程: node memory-guard.js monitor');
                });
            });
        });
    });
});
