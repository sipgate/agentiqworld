/**
 * Admin Dashboard API Client
 * Handles authentication and API calls to the admin endpoints
 */

// API URLs
const PB_URL = window.API_URL || 'http://localhost:8090';
const ADMIN_API_BASE = window.ADMIN_API_BASE || '';  // Same origin, or set explicitly

// Initialize PocketBase for admin auth
const pb = new PocketBase(PB_URL);

const adminApi = {
    /**
     * Get PocketBase instance
     */
    client: pb,

    /**
     * Get PocketBase URL
     */
    getPocketBaseUrl() {
        return PB_URL;
    },

    /**
     * Get auth token
     */
    getToken() {
        return pb.authStore.token;
    },

    /**
     * Check if admin is authenticated
     */
    isAuthenticated() {
        return pb.authStore.isValid && pb.authStore.isAdmin;
    },

    /**
     * Get current admin
     */
    currentAdmin() {
        return pb.authStore.record;
    },

    /**
     * Login as admin
     */
    async login(email, password) {
        return pb.collection('_superusers').authWithPassword(email, password);
    },

    /**
     * Logout
     */
    logout() {
        pb.authStore.clear();
        this.disconnectLogStream();
    },

    /**
     * Subscribe to auth state changes
     */
    onAuthChange(callback) {
        return pb.authStore.onChange(callback);
    },

    /**
     * Make authenticated API request
     */
    async request(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Request failed: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Get system metrics
     */
    async getSystem() {
        return this.request('/api/system');
    },

    /**
     * Get service statuses
     */
    async getServices() {
        return this.request('/api/services');
    },

    /**
     * Get request logs
     */
    async getLogs(type = 'all', limit = 50) {
        return this.request(`/api/logs?type=${type}&limit=${limit}`);
    },

    /**
     * Get PocketBase collections with record counts
     */
    async getCollections() {
        return this.request('/api/collections');
    },

    /**
     * Get request analytics
     */
    async getAnalytics(period = '1h') {
        return this.request(`/api/analytics?period=${period}`);
    },

    /**
     * Get environment info
     */
    async getEnvironment() {
        return this.request('/api/environment');
    },

    /**
     * Get backups list
     */
    async getBackups() {
        return this.request('/api/backups');
    },

    /**
     * Create a new backup
     */
    async createBackup(name) {
        return this.request('/api/backups', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
    },

    /**
     * Delete a backup
     */
    async deleteBackup(key) {
        return this.request(`/api/backups/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });
    },

    /**
     * Get backup download URL
     */
    getBackupDownloadUrl(key) {
        return `${ADMIN_API_BASE}/api/backups/${encodeURIComponent(key)}/download`;
    },

    // Log streaming
    _logStreamEventSource: null,
    _logStreamCallbacks: new Set(),

    /**
     * Connect to log stream
     */
    connectLogStream(callback) {
        this._logStreamCallbacks.add(callback);

        if (!this._logStreamEventSource) {
            const token = this.getToken();
            if (!token) return;

            const url = `${ADMIN_API_BASE}/api/logs/stream?token=${encodeURIComponent(token)}`;
            this._logStreamEventSource = new EventSource(url);

            this._logStreamEventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this._logStreamCallbacks.forEach(cb => cb(data));
                } catch (err) {
                    console.error('Failed to parse log stream message:', err);
                }
            };

            this._logStreamEventSource.onerror = (err) => {
                console.error('Log stream error:', err);
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (this._logStreamEventSource) {
                        this.disconnectLogStream();
                        if (this._logStreamCallbacks.size > 0) {
                            this.connectLogStream([...this._logStreamCallbacks][0]);
                        }
                    }
                }, 5000);
            };
        }

        return () => {
            this._logStreamCallbacks.delete(callback);
            if (this._logStreamCallbacks.size === 0) {
                this.disconnectLogStream();
            }
        };
    },

    /**
     * Disconnect from log stream
     */
    disconnectLogStream() {
        if (this._logStreamEventSource) {
            this._logStreamEventSource.close();
            this._logStreamEventSource = null;
        }
        this._logStreamCallbacks.clear();
    }
};

// Make available globally
window.adminApi = adminApi;
