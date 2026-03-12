/**
 * Admin Dashboard JavaScript
 * Handles authentication flow and dashboard functionality
 */

// View elements
const views = {
    loading: document.getElementById('auth-loading'),
    login: document.getElementById('login-view'),
    dashboard: document.getElementById('dashboard-view')
};

// Form elements
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const adminEmailEl = document.getElementById('admin-email');

// Refresh buttons
const refreshSystemBtn = document.getElementById('refresh-system');
const refreshServicesBtn = document.getElementById('refresh-services');
const refreshLogsBtn = document.getElementById('refresh-logs');
const refreshAnalyticsBtn = document.getElementById('refresh-analytics');
const refreshCollectionsBtn = document.getElementById('refresh-collections');
const refreshEnvironmentBtn = document.getElementById('refresh-environment');
const refreshBackupsBtn = document.getElementById('refresh-backups');
const createBackupBtn = document.getElementById('create-backup');

// Analytics elements
const analyticsPeriodSelect = document.getElementById('analytics-period');

// Log streaming elements
const logsStreamToggle = document.getElementById('logs-stream-toggle');
const clearLogsBtn = document.getElementById('clear-logs');
let logStreamUnsubscribe = null;

/**
 * Show a specific view and hide others
 */
function showView(viewName) {
    Object.entries(views).forEach(([name, el]) => {
        if (el) {
            el.style.display = name === viewName ? '' : 'none';
        }
    });
}

/**
 * Show error message
 */
function showError(errorEl, message) {
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

/**
 * Hide error message
 */
function hideError(errorEl) {
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return '--';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

/**
 * Format seconds to human readable
 */
function formatUptime(seconds) {
    if (!seconds) return '--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

/**
 * Format date to relative time
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

/**
 * Load system metrics
 */
async function loadSystem() {
    try {
        const data = await adminApi.getSystem();

        // App memory with host percentage
        document.getElementById('memory-usage').textContent =
            `${formatBytes(data.memory.app)} (${data.memory.hostPercent}% of host)`;

        // Node.js heap usage
        const heapPercent = Math.round((data.memory.node.heapUsed / data.memory.node.heapTotal) * 100);
        document.getElementById('heap-usage').textContent =
            `${heapPercent}% (${formatBytes(data.memory.node.heapUsed)} / ${formatBytes(data.memory.node.heapTotal)})`;

        document.getElementById('uptime').textContent = formatUptime(data.uptime);
        document.getElementById('cpu-cores').textContent = data.cpu.cores;
    } catch (error) {
        console.error('Failed to load system metrics:', error);
    }
}

/**
 * Get service URL based on name
 */
function getServiceUrl(serviceName) {
    const pbUrl = adminApi.getPocketBaseUrl();
    const host = window.location.hostname;

    const urls = {
        homepage: `http://${host}:3000`,
        webapp: `http://${host}:3001`,
        admin: `http://${host}:3002`,
        pocketbase: `${pbUrl}/_/`
    };

    return urls[serviceName] || null;
}

/**
 * Load services status
 */
async function loadServices() {
    const container = document.getElementById('services-list');
    try {
        const data = await adminApi.getServices();

        container.innerHTML = data.services.map(service => {
            const url = getServiceUrl(service.name);
            const nameHtml = url
                ? `<a href="${url}" target="_blank" class="service-name">${service.name}</a>`
                : `<span class="service-name">${service.name}</span>`;

            return `
                <div class="service-item">
                    ${nameHtml}
                    <span class="service-status status-${service.status}">
                        <span class="status-indicator"></span>
                        ${service.status}
                    </span>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load services:', error);
        container.innerHTML = '<p class="placeholder">Failed to load services</p>';
    }
}

/**
 * Load request analytics
 */
async function loadAnalytics() {
    const period = analyticsPeriodSelect?.value || '1h';

    try {
        const data = await adminApi.getAnalytics(period);

        // Update summary stats
        document.getElementById('analytics-total').textContent = data.totalRequests.toLocaleString();
        document.getElementById('analytics-rpm').textContent = data.requestsPerMinute.toFixed(1);
        document.getElementById('analytics-avg-time').textContent = `${data.avgResponseTime}ms`;
        document.getElementById('analytics-error-rate').textContent = `${data.errorRate}%`;

        // Render timeline chart
        renderTimelineChart(data.timeline, period);

        // Render status distribution
        renderStatusDistribution(data.statusCodes);
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

/**
 * Render simple ASCII-style timeline chart
 */
function renderTimelineChart(timeline, period) {
    const container = document.getElementById('analytics-timeline');
    if (!container || !timeline || timeline.length === 0) {
        if (container) container.innerHTML = '<p class="placeholder">No data available</p>';
        return;
    }

    const maxCount = Math.max(...timeline.map(t => t.count), 1);
    const barHeight = 60;

    const bars = timeline.map((point, i) => {
        const height = (point.count / maxCount) * barHeight;
        const time = new Date(point.time);
        const label = period === '24h'
            ? time.getHours() + 'h'
            : time.getMinutes() + 'm';

        return `
            <div class="chart-bar" title="${point.count} requests at ${time.toLocaleTimeString()}">
                <div class="bar-fill" style="height: ${height}px"></div>
                ${i % Math.ceil(timeline.length / 8) === 0 ? `<span class="bar-label">${label}</span>` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="chart-bars">${bars}</div>`;
}

/**
 * Render status code distribution
 */
function renderStatusDistribution(statusCodes) {
    const container = document.getElementById('status-distribution');
    if (!container) return;

    const total = Object.values(statusCodes).reduce((a, b) => a + b, 0);
    if (total === 0) {
        container.innerHTML = '';
        return;
    }

    const colors = {
        '2xx': 'var(--color-success)',
        '3xx': 'var(--color-primary)',
        '4xx': 'var(--color-warning)',
        '5xx': 'var(--color-error)'
    };

    const segments = Object.entries(statusCodes).map(([code, count]) => {
        const percent = (count / total) * 100;
        return `
            <div class="status-segment" style="width: ${percent}%; background: ${colors[code] || 'var(--color-text-muted)'}">
                <span class="segment-label">${code}: ${count}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="status-bar">${segments}</div>`;
}

/**
 * Load collections overview
 */
async function loadCollections() {
    const container = document.getElementById('collections-list');
    try {
        const data = await adminApi.getCollections();

        if (!data.collections || data.collections.length === 0) {
            container.innerHTML = '<p class="placeholder">No collections found</p>';
            return;
        }

        const collectionsHtml = data.collections.map(col => `
            <div class="collection-item">
                <div class="collection-info">
                    <span class="collection-name">${col.name}</span>
                    <span class="collection-type">${col.type}</span>
                </div>
                <span class="collection-count">${col.recordCount !== null ? col.recordCount.toLocaleString() : '--'} records</span>
            </div>
        `).join('');

        const dbSizeHtml = data.databaseSize
            ? `<div class="db-size">Database: ${formatBytes(data.databaseSize)}</div>`
            : '';

        container.innerHTML = collectionsHtml + dbSizeHtml;
    } catch (error) {
        console.error('Failed to load collections:', error);
        container.innerHTML = '<p class="placeholder">Failed to load collections</p>';
    }
}

/**
 * Load environment info
 */
async function loadEnvironment() {
    const container = document.getElementById('environment-info');
    try {
        const data = await adminApi.getEnvironment();

        const envVars = Object.entries(data.env || {}).map(([key, value]) => `
            <div class="env-item">
                <span class="env-key">${key}</span>
                <span class="env-value">${value}</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="env-item">
                <span class="env-key">Node.js</span>
                <span class="env-value">${data.nodeVersion}</span>
            </div>
            <div class="env-item">
                <span class="env-key">Platform</span>
                <span class="env-value">${data.platform} (${data.arch})</span>
            </div>
            <div class="env-item">
                <span class="env-key">Process Uptime</span>
                <span class="env-value">${formatUptime(data.uptime)}</span>
            </div>
            <div class="env-item">
                <span class="env-key">PocketBase</span>
                <span class="env-value">${data.pocketbase?.status || 'unknown'}</span>
            </div>
            ${envVars}
        `;
    } catch (error) {
        console.error('Failed to load environment:', error);
        container.innerHTML = '<p class="placeholder">Failed to load environment</p>';
    }
}

/**
 * Load backups list
 */
async function loadBackups() {
    const container = document.getElementById('backups-list');
    try {
        const backups = await adminApi.getBackups();

        if (!backups || backups.length === 0) {
            container.innerHTML = '<p class="placeholder">No backups found</p>';
            return;
        }

        container.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <span class="backup-name">${backup.key}</span>
                    <span class="backup-size">${formatBytes(backup.size)}</span>
                </div>
                <div class="backup-actions">
                    <a href="${adminApi.getBackupDownloadUrl(backup.key)}" class="btn btn-sm" download>Download</a>
                    <button class="btn btn-sm btn-danger" onclick="deleteBackup('${backup.key}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load backups:', error);
        container.innerHTML = '<p class="placeholder">Failed to load backups</p>';
    }
}

/**
 * Create a new backup
 */
async function createBackup() {
    const btn = createBackupBtn;
    const originalText = btn.textContent;
    btn.textContent = 'Creating...';
    btn.disabled = true;

    try {
        await adminApi.createBackup();
        await loadBackups();
    } catch (error) {
        console.error('Failed to create backup:', error);
        alert('Failed to create backup: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Delete a backup
 */
async function deleteBackup(key) {
    if (!confirm(`Delete backup "${key}"?`)) return;

    try {
        await adminApi.deleteBackup(key);
        await loadBackups();
    } catch (error) {
        console.error('Failed to delete backup:', error);
        alert('Failed to delete backup: ' + error.message);
    }
}

// Make deleteBackup available globally for onclick handlers
window.deleteBackup = deleteBackup;

/**
 * Handle log stream messages
 */
function handleLogStreamMessage(message) {
    const container = document.getElementById('live-logs');
    if (!container) return;

    if (message.type === 'connected') {
        // Clear placeholder on connect
        if (container.querySelector('.placeholder')) {
            container.innerHTML = '';
        }
        return;
    }

    if (message.type === 'ping') {
        return;
    }

    if (message.type === 'log' && message.data) {
        const log = message.data;
        const logEl = document.createElement('div');
        logEl.className = `log-entry log-${log.level}`;

        const time = new Date(log.timestamp).toLocaleTimeString();
        logEl.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-level">${log.level}</span>
            <span class="log-source">${log.source}</span>
            <span class="log-message">${escapeHtml(log.message)}</span>
        `;

        // Remove placeholder if present
        const placeholder = container.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        // Add to top
        container.insertBefore(logEl, container.firstChild);

        // Limit to 100 entries
        while (container.children.length > 100) {
            container.removeChild(container.lastChild);
        }
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Toggle log streaming
 */
function toggleLogStream(enabled) {
    if (enabled) {
        logStreamUnsubscribe = adminApi.connectLogStream(handleLogStreamMessage);
    } else {
        if (logStreamUnsubscribe) {
            logStreamUnsubscribe();
            logStreamUnsubscribe = null;
        }
        adminApi.disconnectLogStream();
    }
}

/**
 * Clear live logs
 */
function clearLiveLogs() {
    const container = document.getElementById('live-logs');
    if (container) {
        container.innerHTML = '<p class="placeholder">Logs cleared. Enable streaming to see new logs...</p>';
    }
}

/**
 * Load request logs
 */
async function loadLogs() {
    const container = document.getElementById('logs-container');
    try {
        const data = await adminApi.getLogs('requests');

        if (!data.logs || data.logs.length === 0) {
            container.innerHTML = '<p class="placeholder">No recent requests</p>';
            return;
        }

        const getStatusClass = (status) => {
            if (status >= 200 && status < 300) return 'status-2xx';
            if (status >= 300 && status < 400) return 'status-3xx';
            if (status >= 400 && status < 500) return 'status-4xx';
            return 'status-5xx';
        };

        container.innerHTML = `
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Status</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.logs.slice(0, 20).map(log => `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td class="log-method">${log.method}</td>
                            <td>${log.path}</td>
                            <td><span class="log-status ${getStatusClass(log.status)}">${log.status}</span></td>
                            <td>${log.duration}ms</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Failed to load logs:', error);
        container.innerHTML = '<p class="placeholder">Failed to load logs</p>';
    }
}

/**
 * Load all dashboard data
 */
async function loadDashboard() {
    await Promise.all([
        loadSystem(),
        loadServices(),
        loadAnalytics(),
        loadCollections(),
        loadEnvironment(),
        loadBackups(),
        loadLogs()
    ]);
}

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
    if (adminApi.isAuthenticated()) {
        const admin = adminApi.currentAdmin();
        if (adminEmailEl && admin) {
            adminEmailEl.textContent = admin.email;
        }
        showView('dashboard');
        loadDashboard();
    } else {
        showView('login');
        // Disconnect log stream on logout
        if (logStreamUnsubscribe) {
            logStreamUnsubscribe();
            logStreamUnsubscribe = null;
        }
    }
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    hideError(loginError);

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await adminApi.login(email, password);
        loginForm.reset();
        updateAuthUI();
    } catch (error) {
        console.error('Login failed:', error);
        showError(loginError, error.message || 'Invalid credentials');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    adminApi.logout();
    updateAuthUI();
}

/**
 * Initialize the dashboard
 */
function init() {
    // Set PocketBase Admin link
    const pbAdminLink = document.getElementById('pb-admin-link');
    if (pbAdminLink) {
        pbAdminLink.href = `${adminApi.getPocketBaseUrl()}/_/`;
    }

    // Set up event listeners
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Refresh buttons
    if (refreshSystemBtn) {
        refreshSystemBtn.addEventListener('click', loadSystem);
    }
    if (refreshServicesBtn) {
        refreshServicesBtn.addEventListener('click', loadServices);
    }
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', loadLogs);
    }
    if (refreshAnalyticsBtn) {
        refreshAnalyticsBtn.addEventListener('click', loadAnalytics);
    }
    if (refreshCollectionsBtn) {
        refreshCollectionsBtn.addEventListener('click', loadCollections);
    }
    if (refreshEnvironmentBtn) {
        refreshEnvironmentBtn.addEventListener('click', loadEnvironment);
    }
    if (refreshBackupsBtn) {
        refreshBackupsBtn.addEventListener('click', loadBackups);
    }
    if (createBackupBtn) {
        createBackupBtn.addEventListener('click', createBackup);
    }

    // Analytics period change
    if (analyticsPeriodSelect) {
        analyticsPeriodSelect.addEventListener('change', loadAnalytics);
    }

    // Log streaming
    if (logsStreamToggle) {
        logsStreamToggle.addEventListener('change', (e) => {
            toggleLogStream(e.target.checked);
        });
    }
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', clearLiveLogs);
    }

    // Subscribe to auth state changes
    adminApi.onAuthChange(() => {
        updateAuthUI();
    });

    // Initial auth check
    updateAuthUI();

    // Auto-refresh every 30 seconds
    setInterval(() => {
        if (adminApi.isAuthenticated()) {
            loadSystem();
            loadServices();
            loadAnalytics();
        }
    }, 30000);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
