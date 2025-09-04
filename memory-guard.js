#!/usr/bin/env node

// 内存守护进程 - 用于监控和限制应用内存使用
const fs = require('fs');
const path = require('path');

class MemoryGuard {
    constructor(options = {}) {
        // 优先使用环境变量中的配置，然后使用传入的options
        const envConfig = process.env.MEMORY_CONFIG ? JSON.parse(process.env.MEMORY_CONFIG) : {};
        
        this.maxMemoryMB = options.maxMemoryMB || envConfig.maxMemoryMB || 200;
        this.checkInterval = options.checkInterval || envConfig.checkInterval || 30000; // 30秒检查一次
        this.gcThreshold = options.gcThreshold || envConfig.gcThreshold || 0.8; // 80%时触发GC
        this.restartThreshold = options.restartThreshold || envConfig.restartThreshold || 0.95; // 95%时重启
        this.isMonitoring = false;
        this.checkTimer = null;
        this.restartCount = 0;
        this.maxRestarts = options.maxRestarts || envConfig.maxRestarts || 10;
        
        // 内存历史记录
        this.memoryHistory = [];
        this.maxHistoryLength = 20;
        
        // 记录配置来源
        this.configSource = process.env.MEMORY_CONFIG ? 'environment' : 'constructor';
    }
    
    // 获取当前内存使用情况
    getCurrentMemory() {
        const memory = process.memoryUsage();
        return {
            rss: Math.round(memory.rss / 1024 / 1024), // 物理内存 MB
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // 堆内存使用 MB
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // 堆内存总计 MB
            external: Math.round(memory.external / 1024 / 1024), // 外部内存 MB
            percentage: (memory.heapUsed / memory.heapTotal) * 100
        };
    }
    
    // 记录内存使用情况
    recordMemory() {
        const memory = this.getCurrentMemory();
        const record = {
            timestamp: Date.now(),
            memory: memory,
            uptime: process.uptime()
        };
        
        this.memoryHistory.push(record);
        
        // 保持历史记录长度
        if (this.memoryHistory.length > this.maxHistoryLength) {
            this.memoryHistory.shift();
        }
        
        return record;
    }
    
    // 强制垃圾回收
    forceGC() {
        if (global.gc) {
            const before = this.getCurrentMemory();
            global.gc();
            const after = this.getCurrentMemory();
            
            const freed = before.heapUsed - after.heapUsed;
            console.log(`🗑️ [MemoryGuard] 垃圾回收完成，释放内存: ${freed}MB`);
            
            return freed;
        } else {
            console.log('⚠️ [MemoryGuard] 垃圾回收不可用，启动时需要 --expose-gc 参数');
            return 0;
        }
    }
    
    // 检查内存使用情况
    checkMemory() {
        const memory = this.recordMemory();
        const memoryUsage = memory.memory.heapUsed;
        const memoryPercentage = memory.memory.percentage;
        
        console.log(`📊 [MemoryGuard] 内存使用: ${memoryUsage}MB / ${this.maxMemoryMB}MB (${memoryPercentage.toFixed(1)}%)`);
        
        // 如果内存使用超过重启阈值，退出进程让PM2重启
        if (memoryUsage >= this.maxMemoryMB * this.restartThreshold) {
            console.log(`🚨 [MemoryGuard] 内存使用过高 (${memoryUsage}MB >= ${this.maxMemoryMB * this.restartThreshold}MB)，准备重启...`);
            this.restartCount++;
            
            if (this.restartCount > this.maxRestarts) {
                console.log(`💀 [MemoryGuard] 重启次数过多 (${this.restartCount})，停止监控`);
                this.stopMonitoring();
                return;
            }
            
            // 优雅退出，让PM2重启
            setTimeout(() => {
                console.log('🔄 [MemoryGuard] 正在重启进程...');
                process.exit(1);
            }, 1000);
            return;
        }
        
        // 如果内存使用超过GC阈值，触发垃圾回收
        if (memoryUsage >= this.maxMemoryMB * this.gcThreshold) {
            console.log(`⚠️ [MemoryGuard] 内存使用较高 (${memoryUsage}MB >= ${this.maxMemoryMB * this.gcThreshold}MB)，触发垃圾回收...`);
            this.forceGC();
        }
        
        // 检查内存增长趋势
        this.checkMemoryTrend();
    }
    
    // 检查内存增长趋势
    checkMemoryTrend() {
        if (this.memoryHistory.length < 5) return;
        
        const recent = this.memoryHistory.slice(-5);
        const first = recent[0];
        const last = recent[recent.length - 1];
        
        const growth = last.memory.heapUsed - first.memory.heapUsed;
        const timeDiff = (last.timestamp - first.timestamp) / 1000; // 秒
        const growthRate = growth / timeDiff; // MB/秒
        
        if (growthRate > 1) { // 每秒增长超过1MB
            console.log(`📈 [MemoryGuard] 检测到内存快速增长: ${growthRate.toFixed(2)}MB/秒`);
            
            // 如果增长过快，提前触发GC
            if (growthRate > 5) {
                console.log('🚨 [MemoryGuard] 内存增长过快，立即触发垃圾回收');
                this.forceGC();
            }
        }
    }
    
    // 开始监控
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('⚠️ [MemoryGuard] 监控已在运行中');
            return;
        }
        
        this.isMonitoring = true;
        console.log(`🔄 [MemoryGuard] 开始监控内存使用，限制: ${this.maxMemoryMB}MB，检查间隔: ${this.checkInterval/1000}秒`);
        
        // 立即检查一次
        this.checkMemory();
        
        // 设置定期检查
        this.checkTimer = setInterval(() => {
            this.checkMemory();
        }, this.checkInterval);
        
        // 监听进程退出信号
        process.on('SIGTERM', () => {
            console.log('📴 [MemoryGuard] 收到SIGTERM信号，停止监控');
            this.stopMonitoring();
        });
        
        process.on('SIGINT', () => {
            console.log('📴 [MemoryGuard] 收到SIGINT信号，停止监控');
            this.stopMonitoring();
        });
    }
    
    // 停止监控
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
        
        console.log('⏹️ [MemoryGuard] 内存监控已停止');
    }
    
    // 获取内存报告
    getReport() {
        const current = this.getCurrentMemory();
        const avgMemory = this.memoryHistory.length > 0 
            ? this.memoryHistory.reduce((sum, record) => sum + record.memory.heapUsed, 0) / this.memoryHistory.length
            : 0;
        
        return {
            current: current,
            average: Math.round(avgMemory),
            maxAllowed: this.maxMemoryMB,
            restartCount: this.restartCount,
            isMonitoring: this.isMonitoring,
            uptime: process.uptime(),
            history: this.memoryHistory
        };
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const args = process.argv.slice(2);
    const maxMemory = parseInt(args[0]) || 200;
    const checkInterval = parseInt(args[1]) || 30;
    
    console.log(`🚀 [MemoryGuard] 启动内存守护进程`);
    console.log(`   最大内存限制: ${maxMemory}MB`);
    console.log(`   检查间隔: ${checkInterval}秒`);
    
    const guard = new MemoryGuard({
        maxMemoryMB: maxMemory,
        checkInterval: checkInterval * 1000
    });
    
    guard.startMonitoring();
    
    // 保持进程运行
    process.on('SIGINT', () => {
        guard.stopMonitoring();
        process.exit(0);
    });
}

module.exports = MemoryGuard;
