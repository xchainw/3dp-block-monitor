#!/usr/bin/env node

// 日志清理脚本
const fs = require('fs');
const path = require('path');

console.log('🧹 3DPass区块监控系统 - 日志清理工具\n');

// 清理日志文件
function cleanupLogs() {
    const logFiles = [
        'error.log',
        'logs/app-error.log',
        'logs/app-out.log', 
        'logs/app-combined.log',
        'logs/web-error.log',
        'logs/web-out.log',
        'logs/web-combined.log'
    ];
    
    let cleanedCount = 0;
    let totalSize = 0;
    
    logFiles.forEach(logFile => {
        const filePath = path.join(__dirname, logFile);
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            
            try {
                fs.unlinkSync(filePath);
                console.log(`✅ 已删除: ${logFile} (${sizeKB}KB)`);
                cleanedCount++;
                totalSize += sizeKB;
            } catch (error) {
                console.log(`❌ 删除失败: ${logFile} - ${error.message}`);
            }
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`\n📊 清理完成: 删除了 ${cleanedCount} 个文件，释放了 ${totalSize}KB 空间`);
    } else {
        console.log('\n📋 没有找到需要清理的日志文件');
    }
}

// 清理备份文件
function cleanupBackups() {
    const backupPattern = /\.backup\.\d+$/;
    const files = fs.readdirSync(__dirname);
    const backupFiles = files.filter(file => backupPattern.test(file));
    
    if (backupFiles.length > 0) {
        console.log('\n🗑️ 发现备份文件:');
        backupFiles.forEach(file => {
            const filePath = path.join(__dirname, file);
            const stats = fs.statSync(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            
            try {
                fs.unlinkSync(filePath);
                console.log(`✅ 已删除: ${file} (${sizeKB}KB)`);
            } catch (error) {
                console.log(`❌ 删除失败: ${file} - ${error.message}`);
            }
        });
    } else {
        console.log('\n📋 没有找到备份文件');
    }
}

// 显示磁盘使用情况
function showDiskUsage() {
    console.log('\n💾 当前磁盘使用情况:');
    
    const files = fs.readdirSync(__dirname);
    const logFiles = files.filter(file => file.endsWith('.log'));
    const dbFiles = files.filter(file => file.endsWith('.db') || file.endsWith('.db-shm') || file.endsWith('.db-wal'));
    
    let totalLogSize = 0;
    let totalDbSize = 0;
    
    logFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        const stats = fs.statSync(filePath);
        totalLogSize += stats.size;
    });
    
    dbFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        const stats = fs.statSync(filePath);
        totalDbSize += stats.size;
    });
    
    console.log(`   日志文件: ${Math.round(totalLogSize / 1024)}KB`);
    console.log(`   数据库文件: ${Math.round(totalDbSize / 1024)}KB`);
    console.log(`   总计: ${Math.round((totalLogSize + totalDbSize) / 1024)}KB`);
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('使用方法:');
        console.log('  node cleanup-logs.js [选项]');
        console.log('');
        console.log('选项:');
        console.log('  --logs     只清理日志文件');
        console.log('  --backups  只清理备份文件');
        console.log('  --all      清理所有文件 (默认)');
        console.log('  --info     只显示磁盘使用情况');
        console.log('  --help     显示帮助信息');
        return;
    }
    
    if (args.includes('--info')) {
        showDiskUsage();
        return;
    }
    
    if (args.includes('--logs') || args.includes('--all') || args.length === 0) {
        cleanupLogs();
    }
    
    if (args.includes('--backups') || args.includes('--all') || args.length === 0) {
        cleanupBackups();
    }
    
    showDiskUsage();
    
    console.log('\n💡 提示:');
    console.log('  - 定期清理日志文件可以释放磁盘空间');
    console.log('  - 数据库文件包含重要数据，请谨慎删除');
    console.log('  - 使用 --info 选项查看磁盘使用情况');
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { cleanupLogs, cleanupBackups, showDiskUsage };
