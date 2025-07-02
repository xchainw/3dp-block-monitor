// 矿工详情页JavaScript - 处理矿工统计和爆块记录

class MinerDashboard {
    constructor() {
        this.dailyChart = null;
        this.refreshInterval = null;
        this.resizeTimeout = null;
        this.minerAddress = '';
        this.init();
    }

    async init() {
        if (!this.extractMinerAddress()) {
            return; // 地址提取失败，停止初始化
        }
        
        await this.loadData();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    // 从URL中提取矿工地址
    extractMinerAddress() {
        const pathParts = window.location.pathname.split('/');
        this.minerAddress = decodeURIComponent(pathParts[pathParts.length - 1]);
        
        console.log('🔍 提取到的矿工地址:', this.minerAddress);
        
        // 在页面上显示矿工地址
        const addressEl = document.getElementById('minerAddress');
        if (addressEl) {
            addressEl.textContent = this.minerAddress;
        }
        
        // 验证地址格式
        if (!this.minerAddress || this.minerAddress === '' || this.minerAddress === 'undefined') {
            console.error('❌ 无效的矿工地址');
            this.showError('无效的矿工地址');
            return false;
        }
        
        return true;
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
                this.loadMinerBlocks(); // 重新渲染爆块记录表格
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
        if (!this.minerAddress) {
            console.error('矿工地址未找到');
            return;
        }

        try {
            await Promise.all([
                this.loadMinerStats(),
                this.loadDailyChart(),
                this.loadMinerBlocks()
            ]);
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showError('数据加载失败，请稍后重试');
        }
    }

    // 加载矿工统计信息
    async loadMinerStats() {
        try {
            const url = `/api/miner/${encodeURIComponent(this.minerAddress)}/stats`;
            console.log('📊 请求矿工统计:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📊 矿工统计数据:', data);
            
            document.getElementById('todayBlocks').textContent = data.today || 0;
            document.getElementById('weekBlocks').textContent = data.week || 0;
            document.getElementById('monthBlocks').textContent = data.month || 0;
            document.getElementById('totalBlocks').textContent = this.formatNumber(data.total || 0);
        } catch (error) {
            console.error('❌ 加载矿工统计失败:', error);
            this.showError('加载矿工统计失败: ' + error.message);
        }
    }

    // 加载每日爆块图表
    async loadDailyChart() {
        try {
            const url = `/api/miner/${encodeURIComponent(this.minerAddress)}/daily`;
            console.log('📈 请求每日数据:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📈 每日数据:', data);
            
            this.renderDailyChart(data);
        } catch (error) {
            console.error('❌ 加载每日图表失败:', error);
            this.showError('加载图表失败: ' + error.message);
        }
    }

    // 绘制每日爆块图表
    renderDailyChart(data) {
        const ctx = document.getElementById('dailyChart').getContext('2d');
        
        // 销毁现有图表
        if (this.dailyChart) {
            this.dailyChart.destroy();
        }

        const labels = data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('zh-CN', { 
                month: 'short', 
                day: 'numeric' 
            });
        });

        const blocksData = data.map(item => item.blocks);

        this.dailyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '每日爆块数',
                    data: blocksData,
                    backgroundColor: 'rgba(100, 181, 246, 0.6)',
                    borderColor: '#64b5f6',
                    borderWidth: 2,
                    borderRadius: 4,
                    borderSkipped: false,
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
                                return `爆块数: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b8c5ff'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#b8c5ff',
                            stepSize: 1
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }

    // 加载矿工最近爆块记录
    async loadMinerBlocks() {
        try {
            const url = `/api/miner/${encodeURIComponent(this.minerAddress)}/blocks`;
            console.log('📋 请求爆块记录:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📋 爆块记录数据:', data);
            
            this.renderBlocksTable(data);
        } catch (error) {
            console.error('❌ 加载爆块记录失败:', error);
            this.showError('加载爆块记录失败: ' + error.message);
        }
    }

    // 渲染爆块记录表格
    renderBlocksTable(blocks) {
        const tbody = document.getElementById('blocksTableBody');
        
        if (blocks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="loading">📊 暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = blocks.map(block => `
            <tr>
                <td>#${Number(block.height).toLocaleString('zh-CN')}</td>
                <td class="hash-cell" title="${block.hash}">${this.truncateHash(block.hash)}</td>
                <td>${block.date}</td>
            </tr>
        `).join('');
    }

    // 工具函数：格式化数字
    formatNumber(num) {
        if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return Number(num).toLocaleString('zh-CN');
    }

    // 工具函数：截取哈希显示（响应式）
    truncateHash(hash) {
        // 检查屏幕宽度，宽屏幕显示完整哈希
        if (window.innerWidth >= 1200) {
            return hash; // 宽屏幕显示完整哈希
        } else if (window.innerWidth >= 768) {
            // 中等屏幕适度截取
            if (hash.length <= 30) return hash;
            return hash.substring(0, 15) + '...' + hash.substring(hash.length - 12);
        } else {
            // 小屏幕严格截取
            if (hash.length <= 20) return hash;
            return hash.substring(0, 10) + '...' + hash.substring(hash.length - 8);
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
        
        // 在页面上显示错误信息
        const errorHtml = `
            <div style="background: rgba(244, 67, 54, 0.1); border: 1px solid #f44336; border-radius: 8px; padding: 15px; margin: 20px 0; color: #ffffff;">
                <h4 style="margin: 0 0 10px 0; color: #f44336;">⚠️ 加载错误</h4>
                <p style="margin: 0;">${message}</p>
                <small style="opacity: 0.7;">请检查网络连接或稍后重试</small>
            </div>
        `;
        
        // 如果有统计区域，显示在那里
        const statsSection = document.querySelector('.miner-stats-section');
        if (statsSection) {
            statsSection.insertAdjacentHTML('afterbegin', errorHtml);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.minerDashboard = new MinerDashboard();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.minerDashboard) {
        window.minerDashboard.stopAutoRefresh();
    }
}); 