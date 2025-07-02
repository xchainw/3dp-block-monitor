const fs = require('fs');
const path = require('path');

// 内存监控工具
class MemoryMonitor {
    constructor() {
        this.startTime = Date.now();
        this.startMemory = process.memoryUsage();
        this.memoryHistory = [];
        this.maxMemoryUsed = 0;
    }
    
    // 获取当前内存使用情况
    getCurrentMemory() {
        const memory = process.memoryUsage();
        const memoryMB = {
            rss: (memory.rss / 1024 / 1024).toFixed(1),           // 物理内存
            heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(1), // 堆内存使用
            heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(1), // 堆内存总计
            external: (memory.external / 1024 / 1024).toFixed(1)    // 外部内存
        };
        
        // 更新最大内存使用记录
        if (memory.heapUsed > this.maxMemoryUsed) {
            this.maxMemoryUsed = memory.heapUsed;
        }
        
        return {
            raw: memory,
            mb: memoryMB,
            percentage: ((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)
        };
    }
    
    // 添加内存使用记录
    addRecord(tag = '') {
        const current = this.getCurrentMemory();
        const record = {
            timestamp: Date.now(),
            tag: tag,
            memory: current,
            uptime: ((Date.now() - this.startTime) / 1000).toFixed(1)
        };
        
        this.memoryHistory.push(record);
        
        // 只保留最近100条记录
        if (this.memoryHistory.length > 100) {
            this.memoryHistory.shift();
        }
        
        return record;
    }
    
    // 显示当前内存状态
    showStatus() {
        const current = this.getCurrentMemory();
        const maxMB = (this.maxMemoryUsed / 1024 / 1024).toFixed(1);
        const uptime = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
        
        console.log('\n📊 内存使用状态:');
        console.log(`  🏃 运行时间: ${uptime} 分钟`);
        console.log(`  💾 当前堆内存: ${current.mb.heapUsed}MB / ${current.mb.heapTotal}MB (${current.percentage}%)`);
        console.log(`  📈 物理内存: ${current.mb.rss}MB`);
        console.log(`  🔗 外部内存: ${current.mb.external}MB`);
        console.log(`  🏔️ 峰值堆内存: ${maxMB}MB`);
        
        // 内存警告
        if (current.raw.heapUsed / 1024 / 1024 > 800) {
            console.log(`  🚨 警告: 内存使用过高 (${current.mb.heapUsed}MB)`);
        } else if (current.raw.heapUsed / 1024 / 1024 > 500) {
            console.log(`  ⚠️ 注意: 内存使用较高 (${current.mb.heapUsed}MB)`);
        } else {
            console.log(`  ✅ 内存使用正常`);
        }
        
        return current;
    }
    
    // 获取内存趋势分析
    getTrend() {
        if (this.memoryHistory.length < 2) {
            return null;
        }
        
        const recent = this.memoryHistory.slice(-10); // 最近10条记录
        const first = recent[0];
        const last = recent[recent.length - 1];
        
        const heapDiff = last.memory.raw.heapUsed - first.memory.raw.heapUsed;
        const timeDiff = last.timestamp - first.timestamp;
        const rate = (heapDiff / timeDiff * 1000).toFixed(2); // bytes/second
        
        return {
            isIncreasing: heapDiff > 0,
            rate: rate,
            rateMB: (rate / 1024 / 1024).toFixed(3),
            duration: (timeDiff / 1000).toFixed(1)
        };
    }
    
    // 获取内存建议
    getRecommendations() {
        const current = this.getCurrentMemory();
        const heapMB = parseFloat(current.mb.heapUsed);
        const trend = this.getTrend();
        
        const recommendations = [];
        
        if (heapMB > 1000) {
            recommendations.push('🚨 立即重启程序，内存使用过高');
            recommendations.push('💡 考虑减小 batchSize 配置到 10-20');
        } else if (heapMB > 700) {
            recommendations.push('⚠️ 建议近期重启程序');
            recommendations.push('🔧 减小 batchSize 到 20-30');
        } else if (heapMB > 500) {
            recommendations.push('👀 密切监控内存使用');
        }
        
        if (trend && trend.isIncreasing && parseFloat(trend.rateMB) > 0.1) {
            recommendations.push('📈 检测到内存上升趋势，注意监控');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ 内存使用健康');
        }
        
        return recommendations;
    }
    
    // 强制垃圾回收（如果可用）
    forceGC() {
        if (global.gc) {
            const before = this.getCurrentMemory();
            global.gc();
            const after = this.getCurrentMemory();
            
            const freed = (before.raw.heapUsed - after.raw.heapUsed) / 1024 / 1024;
            console.log(`🗑️ 垃圾回收完成，释放内存: ${freed.toFixed(1)}MB`);
            
            return freed;
        } else {
            console.log('⚠️ 垃圾回收不可用，启动时需要 --expose-gc 参数');
            return 0;
        }
    }
    
    // 导出内存报告
    exportReport(filename = null) {
        if (!filename) {
            filename = `memory-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        }
        
        const report = {
            timestamp: new Date().toISOString(),
            runtime: ((Date.now() - this.startTime) / 1000 / 60).toFixed(1) + ' minutes',
            currentMemory: this.getCurrentMemory(),
            maxMemoryUsed: (this.maxMemoryUsed / 1024 / 1024).toFixed(1) + 'MB',
            memoryHistory: this.memoryHistory,
            trend: this.getTrend(),
            recommendations: this.getRecommendations(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
        };
        
        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`📄 内存报告已导出: ${filename}`);
        
        return filename;
    }
}

// 创建全局内存监控实例
const memoryMonitor = new MemoryMonitor();

// 定期监控（每分钟）
let monitorInterval = null;

function startMonitoring(intervalMinutes = 5) {
    if (monitorInterval) {
        clearInterval(monitorInterval);
    }
    
    monitorInterval = setInterval(() => {
        memoryMonitor.addRecord('auto-check');
        const recommendations = memoryMonitor.getRecommendations();
        
        // 只在有警告时输出
        if (recommendations.some(r => r.includes('🚨') || r.includes('⚠️'))) {
            memoryMonitor.showStatus();
            console.log('💡 建议:');
            recommendations.forEach(rec => console.log(`  ${rec}`));
        }
    }, intervalMinutes * 60 * 1000);
    
    console.log(`🔄 内存监控已启动，每 ${intervalMinutes} 分钟检查一次`);
}

function stopMonitoring() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log('⏹️ 内存监控已停止');
    }
}

// 命令行工具
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'status':
            memoryMonitor.showStatus();
            break;
            
        case 'gc':
            memoryMonitor.forceGC();
            break;
            
        case 'report':
            memoryMonitor.exportReport();
            break;
            
        case 'monitor':
            const interval = parseInt(process.argv[3]) || 1;
            startMonitoring(interval);
            console.log('按 Ctrl+C 停止监控...');
            process.on('SIGINT', () => {
                stopMonitoring();
                process.exit(0);
            });
            break;
            
        default:
            console.log('🔧 内存监控工具使用说明:');
            console.log('  node memory-monitor.js status    - 显示当前内存状态');
            console.log('  node memory-monitor.js gc        - 强制垃圾回收');
            console.log('  node memory-monitor.js report    - 导出内存报告');
            console.log('  node memory-monitor.js monitor [分钟] - 开始监控 (默认1分钟)');
    }
}

module.exports = {
    MemoryMonitor,
    memoryMonitor,
    startMonitoring,
    stopMonitoring
}; 