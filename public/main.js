// 主页JavaScript - 处理哈希率图表和矿工排名

class MainDashboard {
    constructor() {
        this.hashrateChart = null;
        this.refreshInterval = null;
        this.resizeTimeout = null;
        this.currentTimeRange = 'today';
        this.customStartDate = null;
        this.customEndDate = null;
        this.isFilterActive = false;
        this.currentMinersData = [];
        this.timezone = this.getUserTimezone();
        this.init();
    }

    // 获取用户时区
    getUserTimezone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
            return 'Asia/Shanghai'; // 默认为中国时区
        }
    }

    async init() {
        this.setupEventListeners();
        this.setupTimeControls();
        this.setupModal();
        this.loadWatchedAddresses();
        this.updateChartTitle(); // 初始化图表标题
        await this.loadData();
        this.startAutoRefresh();
    }

    // 设置事件监听器
    setupEventListeners() {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.renderMinersTable(this.currentMinersData);
            }, 300);
        });
    }

    // 设置时间控制
    setupTimeControls() {
        // 时间范围按钮
        const timeButtons = document.querySelectorAll('.time-btn');
        timeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                timeButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTimeRange = e.target.dataset.range;
                
                const customDateRange = document.getElementById('customDateRange');
                if (this.currentTimeRange === 'custom') {
                    customDateRange.style.display = 'flex';
                    this.setupCustomDateInputs();
                } else {
                    customDateRange.style.display = 'none';
                    this.loadMinersData();
                    this.loadHashrateChart(); // 重新加载哈希率图表
                }
                
                this.updateSectionTitle();
                this.updateChartTitle(); // 更新图表标题
            });
        });

        // 自定义日期应用按钮
        const applyBtn = document.getElementById('applyDateRange');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                
                if (startDate && endDate) {
                    this.customStartDate = startDate;
                    this.customEndDate = endDate;
                    
                    // 保存自定义日期到localStorage
                    this.saveCustomDateRange(startDate, endDate);
                    
                    this.loadMinersData();
                    this.loadHashrateChart(); // 重新加载哈希率图表
                } else {
                    alert('请选择开始和结束日期');
                }
            });
        }

        // 设置和过滤按钮
        const settingsBtn = document.getElementById('settingsBtn');
        const filterBtn = document.getElementById('filterBtn');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettingsModal());
        }
        
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.toggleFilter());
        }
    }

    // 设置自定义日期输入默认值
    setupCustomDateInputs() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        // 首先尝试从localStorage加载保存的日期
        const savedDates = this.loadCustomDateRange();
        
        if (savedDates.start && savedDates.end) {
            startDateInput.value = savedDates.start;
            endDateInput.value = savedDates.end;
            this.customStartDate = savedDates.start;
            this.customEndDate = savedDates.end;
        } else {
            // 如果没有保存的日期，使用今天作为默认值
            const today = new Date().toISOString().split('T')[0];
            if (!startDateInput.value) startDateInput.value = today;
            if (!endDateInput.value) endDateInput.value = today;
        }
    }

    // 保存自定义日期范围到localStorage
    saveCustomDateRange(startDate, endDate) {
        try {
            const dateRange = { start: startDate, end: endDate };
            localStorage.setItem('3dp-custom-date-range', JSON.stringify(dateRange));
        } catch (e) {
            console.error('保存自定义日期范围失败:', e);
        }
    }

    // 从localStorage加载自定义日期范围
    loadCustomDateRange() {
        try {
            const stored = localStorage.getItem('3dp-custom-date-range');
            return stored ? JSON.parse(stored) : { start: null, end: null };
        } catch (e) {
            console.error('加载自定义日期范围失败:', e);
            return { start: null, end: null };
        }
    }

    // 设置模态框
    setupModal() {
        const modal = document.getElementById('settingsModal');
        const closeBtn = document.getElementById('closeSettings');
        const addBtn = document.getElementById('addAddress');

        // 关闭模态框
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // 点击外部关闭模态框
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // 添加地址
        addBtn.addEventListener('click', () => this.addWatchedAddress());

        // 回车键添加地址
        const addressInput = document.getElementById('newAddress');
        const aliasInput = document.getElementById('newAlias');
        
        [addressInput, aliasInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addWatchedAddress();
                }
            });
        });
    }

    // 更新段落标题
    updateSectionTitle() {
        const titleEl = document.getElementById('sectionTitle');
        const titles = {
            'today': '🏆 今日爆块排名',
            'week': '🏆 本周爆块排名',
            'month': '🏆 本月爆块排名',
            'custom': '🏆 自定义时段爆块排名'
        };
        
        if (titleEl) {
            titleEl.textContent = titles[this.currentTimeRange] || '🏆 爆块排名';
        }
    }

    // 更新图表标题
    updateChartTitle() {
        const chartTitleEl = document.querySelector('.chart-container h3');
        const titles = {
            'today': '📈 今日哈希率趋势',
            'week': '📈 本周哈希率趋势', 
            'month': '📈 本月哈希率趋势',
            'custom': '📈 自定义时段哈希率趋势'
        };
        
        if (chartTitleEl) {
            chartTitleEl.textContent = titles[this.currentTimeRange] || '📈 哈希率趋势';
        }
    }

    // 获取时间范围
    getTimeRange() {
        const now = new Date();
        let startTime, endTime;

        switch (this.currentTimeRange) {
            case 'today':
                startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'week':
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 周一
                startOfWeek.setHours(0, 0, 0, 0);
                startTime = startOfWeek;
                endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'month':
                startTime = new Date(now.getFullYear(), now.getMonth(), 1);
                endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;
            case 'custom':
                if (this.customStartDate && this.customEndDate) {
                    startTime = new Date(this.customStartDate + 'T00:00:00');
                    endTime = new Date(this.customEndDate + 'T23:59:59');
                } else {
                    return this.getTimeRange.call({currentTimeRange: 'today'});
                }
                break;
            default:
                return this.getTimeRange.call({currentTimeRange: 'today'});
        }

        return {
            start: Math.floor(startTime.getTime() / 1000),
            end: Math.floor(endTime.getTime() / 1000)
        };
    }

    // 开始自动刷新
    startAutoRefresh() {
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
                this.loadMinersData()
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
        } catch (error) {
            console.error('加载当前统计失败:', error);
        }
    }

    // 加载哈希率图表
    async loadHashrateChart() {
        try {
            const timeRange = this.getTimeRange();
            const response = await fetch(`/api/hashrate/24h?start=${timeRange.start}&end=${timeRange.end}`);
            const data = await response.json();
            
            this.renderHashrateChart(data);
        } catch (error) {
            console.error('加载哈希率图表失败:', error);
        }
    }

    // 绘制哈希率图表
    renderHashrateChart(data) {
        const ctx = document.getElementById('hashrateChart').getContext('2d');
        
        if (this.hashrateChart) {
            this.hashrateChart.destroy();
        }

        if (data.length === 0) {
            // 如果没有数据，显示空图表
            this.hashrateChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
            return;
        }

        // 根据时间范围动态调整时间格式
        const timeRange = this.getTimeRange();
        const timeSpan = timeRange.end - timeRange.start;
        
        const labels = data.map(item => {
            const date = new Date(item.timestamp * 1000);
            
            if (timeSpan <= 24 * 3600) {
                // 24小时内显示时:分
                return date.toLocaleTimeString('zh-CN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else if (timeSpan <= 7 * 24 * 3600) {
                // 7天内显示月/日 时:分
                return date.toLocaleDateString('zh-CN', { 
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } else {
                // 超过7天显示月/日
                return date.toLocaleDateString('zh-CN', { 
                    month: 'numeric',
                    day: 'numeric'
                });
            }
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
                            font: { size: 12 }
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

    // 加载矿工数据
    async loadMinersData() {
        try {
            const timeRange = this.getTimeRange();
            const response = await fetch(`/api/period-miners?start=${timeRange.start}&end=${timeRange.end}`);
            const data = await response.json();
            
            this.currentMinersData = data;
            
            // 更新当前时段矿工数
            document.getElementById('periodMiners').textContent = data.length;
            
            this.renderMinersTable(data);
        } catch (error) {
            console.error('加载矿工数据失败:', error);
            // 回退到今日矿工数据
            try {
                const response = await fetch('/api/today-miners');
                const data = await response.json();
                this.currentMinersData = data;
                document.getElementById('periodMiners').textContent = data.length;
                this.renderMinersTable(data);
            } catch (fallbackError) {
                console.error('加载今日矿工数据也失败:', fallbackError);
            }
        }
    }

    // 渲染矿工排名表格
    async renderMinersTable(miners) {
        const tbody = document.getElementById('minersTableBody');
        const statsFooter = document.getElementById('statsFooter');
        
        if (miners.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">📊 暂无数据</td></tr>';
            statsFooter.style.display = 'none';
            return;
        }

        // 应用过滤
        const watchedAddresses = this.getWatchedAddresses();
        let displayMiners = miners;
        if (this.isFilterActive) {
            displayMiners = miners.filter(miner => 
                watchedAddresses.some(w => w.address === miner.author)
            );
        }

        if (displayMiners.length === 0 && this.isFilterActive) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">🔍 没有找到关注的地址</td></tr>';
            statsFooter.style.display = 'none';
            return;
        }

        // 直接渲染表格（KYC信息已包含在数据中）
        tbody.innerHTML = displayMiners.map(miner => {
            const watchedAddress = watchedAddresses.find(w => w.address === miner.author);
            
            // 构建地址显示内容
            let addressContent = `<span class="address-text" title="${miner.author}">${this.truncateAddress(miner.author)}</span>`;
            
            // 添加别名标签
            if (watchedAddress && watchedAddress.alias) {
                addressContent += `<a href="https://3dpscan.xyz/#/accounts/${miner.author}?sub=identity_timeline&tab=identity" 
                    target="_blank" class="tag alias-tag" title="别名" onclick="event.stopPropagation()">${watchedAddress.alias}</a>`;
            }
            
            // 添加KYC标签（直接使用后端返回的KYC数据）
            if (miner.kyc && miner.kyc.display) {
                addressContent += `<a href="https://3dpscan.xyz/#/accounts/${miner.author}?sub=identity_timeline&tab=identity" 
                    target="_blank" class="tag kyc-tag" title="KYC认证" onclick="event.stopPropagation()">${miner.kyc.display}</a>`;
            }

            return `
                <tr>
                    <td class="rank-cell rank-${miner.rank <= 3 ? miner.rank : 'other'}">#${miner.rank}</td>
                    <td class="address-cell" onclick="window.location.href='/miner/${encodeURIComponent(miner.author)}'">${addressContent}</td>
                    <td>${miner.score}</td>
                    <td class="percentage-cell">${miner.share}</td>
                    <td>#${Number(miner.lastHeight).toLocaleString('zh-CN')}</td>
                    <td>${miner.lastTime}</td>
                </tr>
            `;
        }).join('');

        // 更新统计信息
        this.updateStats(displayMiners, miners);
        statsFooter.style.display = 'table-footer-group';
    }

    // 更新统计信息
    updateStats(displayMiners, allMiners) {
        const totalBlocks = displayMiners.reduce((sum, miner) => sum + miner.score, 0);
        const allTotalBlocks = allMiners.reduce((sum, miner) => sum + miner.score, 0);
        const percentage = allTotalBlocks > 0 ? ((totalBlocks / allTotalBlocks) * 100).toFixed(2) : '0.00';
        
        document.getElementById('totalBlocks').textContent = totalBlocks.toLocaleString('zh-CN');
        document.getElementById('totalPercentage').textContent = `${percentage}%`;
    }

    // 打开设置模态框
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'block';
        this.renderWatchedAddressList();
    }

    // 切换过滤状态
    toggleFilter() {
        this.isFilterActive = !this.isFilterActive;
        const filterBtn = document.getElementById('filterBtn');
        
        if (this.isFilterActive) {
            filterBtn.classList.add('active');
            filterBtn.title = '显示全部地址';
        } else {
            filterBtn.classList.remove('active');
            filterBtn.title = '筛选关注地址';
        }
        
        this.renderMinersTable(this.currentMinersData);
    }

    // 添加关注地址
    addWatchedAddress() {
        const addressInput = document.getElementById('newAddress');
        const aliasInput = document.getElementById('newAlias');
        
        const address = addressInput.value.trim();
        const alias = aliasInput.value.trim();
        
        if (!address) {
            alert('请输入地址');
            return;
        }
        
        const watchedAddresses = this.getWatchedAddresses();
        
        // 检查是否已存在
        if (watchedAddresses.some(w => w.address === address)) {
            alert('该地址已在关注列表中');
            return;
        }
        
        // 添加到列表
        watchedAddresses.push({ address, alias });
        this.saveWatchedAddresses(watchedAddresses);
        
        // 清空输入框
        addressInput.value = '';
        aliasInput.value = '';
        
        // 重新渲染列表
        this.renderWatchedAddressList();
        
        // 如果当前是过滤状态，重新渲染表格
        if (this.isFilterActive) {
            this.renderMinersTable(this.currentMinersData);
        }
    }

    // 移除关注地址
    removeWatchedAddress(address) {
        if (confirm('确定要移除这个关注地址吗？')) {
            const watchedAddresses = this.getWatchedAddresses();
            const filteredAddresses = watchedAddresses.filter(w => w.address !== address);
            this.saveWatchedAddresses(filteredAddresses);
            this.renderWatchedAddressList();
            
            // 如果当前是过滤状态，重新渲染表格
            if (this.isFilterActive) {
                this.renderMinersTable(this.currentMinersData);
            }
        }
    }

    // 渲染关注地址列表
    renderWatchedAddressList() {
        const listContainer = document.getElementById('watchedAddressList');
        const watchedAddresses = this.getWatchedAddresses();
        
        if (watchedAddresses.length === 0) {
            listContainer.innerHTML = '<p class="empty-message">暂无关注地址</p>';
            return;
        }
        
        listContainer.innerHTML = watchedAddresses.map(watched => `
            <div class="address-item">
                <div class="address-info">
                    <div class="address-text">${watched.address}</div>
                    ${watched.alias ? `<div class="alias-text">别名: ${watched.alias}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="window.mainDashboard.removeWatchedAddress('${watched.address}')">
                    删除
                </button>
            </div>
        `).join('');
    }

    // 获取关注地址
    getWatchedAddresses() {
        try {
            const stored = localStorage.getItem('3dp-watched-addresses');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('获取关注地址失败:', e);
            return [];
        }
    }

    // 保存关注地址
    saveWatchedAddresses(addresses) {
        try {
            localStorage.setItem('3dp-watched-addresses', JSON.stringify(addresses));
        } catch (e) {
            console.error('保存关注地址失败:', e);
        }
    }

    // 加载关注地址（初始化时）
    loadWatchedAddresses() {
        // 这里可以添加初始化逻辑
        const watchedAddresses = this.getWatchedAddresses();
        console.log(`已加载 ${watchedAddresses.length} 个关注地址`);
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
        if (window.innerWidth >= 1200) {
            return address;
        } else if (window.innerWidth >= 768) {
            if (address.length <= 24) return address;
            return address.substring(0, 12) + '...' + address.substring(address.length - 8);
        } else {
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