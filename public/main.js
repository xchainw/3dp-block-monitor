// 主页JavaScript - 处理哈希率图表和矿工排名

class MainDashboard {
    constructor() {
        this.hashrateChart = null;
        this.refreshInterval = null;
        this.resizeTimeout = null;
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    // 设置事件监听器
    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
        
        // 监听窗口大小变化，重新渲染表格以适应新的截取规则
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.loadTodayMiners(); // 重新渲染矿工表格
            }, 300);
        });
    }

    // 开始自动刷新
    startAutoRefresh() {
        // 每30秒自动刷新一次
        this.refreshInterval = setInterval(() => {
            this.loadData();
        }, 30000);
    }

    // 停止自动刷新
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }

    // 加载所有数据
    async loadData() {
        try {
            await Promise.all([
                this.loadCurrentStats(),
                this.loadHashrateChart(),
                this.loadTodayMiners()
            ]);
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showError('数据加载失败，请稍后重试');
        }
    }

    // 加载当前统计信息
    async loadCurrentStats() {
        try {
            const response = await fetch('/api/current-stats');
            const data = await response.json();
            
            document.getElementById('currentDifficulty').textContent = 
                this.formatNumber(data.currentDifficulty);
            document.getElementById('currentHashrate').textContent = 
                data.currentHashrateFormatted;
            document.getElementById('blockReward').textContent = 
                this.formatNumber(data.blockReward) + ' 3DP';
            document.getElementById('todayMiners').textContent = 
                data.todayMiners;
        } catch (error) {
            console.error('加载当前统计失败:', error);
        }
    }

    // 加载哈希率图表
    async loadHashrateChart() {
        try {
            const response = await fetch('/api/hashrate/24h');
            const data = await response.json();
            
            this.renderHashrateChart(data);
        } catch (error) {
            console.error('加载哈希率图表失败:', error);
        }
    }

    // 绘制哈希率图表
    renderHashrateChart(data) {
        const ctx = document.getElementById('hashrateChart').getContext('2d');
        
        // 销毁现有图表
        if (this.hashrateChart) {
            this.hashrateChart.destroy();
        }

        const labels = data.map(item => {
            const date = new Date(item.timestamp * 1000);
            return date.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        });

        const hashrateData = data.map(item => item.hashrate);

        this.hashrateChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '哈希率 (H/s)',
                    data: hashrateData,
                    borderColor: '#64b5f6',
                    backgroundColor: 'rgba(100, 181, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#64b5f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#64b5f6',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `哈希率: ${this.formatHashrate(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b8c5ff',
                            maxTicksLimit: 12
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#b8c5ff',
                            callback: (value) => this.formatHashrate(value)
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // 加载今日矿工排名
    async loadTodayMiners() {
        try {
            const response = await fetch('/api/today-miners');
            const data = await response.json();
            
            this.renderMinersTable(data);
        } catch (error) {
            console.error('加载矿工排名失败:', error);
        }
    }

    // 渲染矿工排名表格
    renderMinersTable(miners) {
        const tbody = document.getElementById('minersTableBody');
        
        if (miners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">📊 暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = miners.map(miner => `
            <tr>
                <td class="rank-cell rank-${miner.rank <= 3 ? miner.rank : 'other'}">#${miner.rank}</td>
                <td class="address-cell" title="${miner.author}" onclick="window.location.href='/miner/${encodeURIComponent(miner.author)}'">${this.truncateAddress(miner.author)}</td>
                <td>${miner.score}</td>
                <td class="percentage-cell">${miner.share}</td>
                <td>#${Number(miner.lastHeight).toLocaleString('zh-CN')}</td>
                <td>${miner.lastTime}</td>
            </tr>
        `).join('');
    }

    // 工具函数：格式化数字
    formatNumber(num) {
        if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return Number(num).toLocaleString('zh-CN');
    }

    // 工具函数：格式化哈希率
    formatHashrate(hashrate) {
        if (hashrate >= 1e12) {
            return (hashrate / 1e12).toFixed(2) + ' TH/s';
        } else if (hashrate >= 1e9) {
            return (hashrate / 1e9).toFixed(2) + ' GH/s';
        } else if (hashrate >= 1e6) {
            return (hashrate / 1e6).toFixed(2) + ' MH/s';
        } else if (hashrate >= 1e3) {
            return (hashrate / 1e3).toFixed(2) + ' KH/s';
        } else {
            return hashrate.toFixed(2) + ' H/s';
        }
    }

    // 工具函数：截取地址显示（响应式）
    truncateAddress(address) {
        // 检查屏幕宽度，宽屏幕显示完整地址
        if (window.innerWidth >= 1200) {
            return address; // 宽屏幕显示完整地址
        } else if (window.innerWidth >= 768) {
            // 中等屏幕适度截取
            if (address.length <= 24) return address;
            return address.substring(0, 12) + '...' + address.substring(address.length - 8);
        } else {
            // 小屏幕严格截取
            if (address.length <= 16) return address;
            return address.substring(0, 8) + '...' + address.substring(address.length - 6);
        }
    }

    // 更新最后更新时间
    updateLastUpdateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN');
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = `最后更新: ${timeStr}`;
        }
    }

    // 显示错误信息
    showError(message) {
        console.error(message);
        // 可以在这里添加更好的错误显示UI
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.mainDashboard = new MainDashboard();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.mainDashboard) {
        window.mainDashboard.stopAutoRefresh();
    }
}); 