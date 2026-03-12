/**
 * Homepage JavaScript
 * Handles service status checks, copy functionality, and interactions
 */

// Service configuration
const SERVICES = {
    homepage: { url: 'http://localhost:3000', healthPath: '/health' },
    webapp: { url: 'http://localhost:3001', healthPath: '/health' },
    admin: { url: 'http://localhost:3002', healthPath: '/health' },
    pocketbase: { url: 'http://localhost:8090', healthPath: '/api/health' }
};

/**
 * Check health of a single service
 */
async function checkServiceHealth(serviceId, config) {
    const statusEl = document.getElementById(`status-${serviceId}`);
    if (!statusEl) return;

    const dotEl = statusEl.querySelector('.status-dot');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${config.url}${config.healthPath}`, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            statusEl.classList.add('online');
            statusEl.classList.remove('offline');
            dotEl.title = 'Online';
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        statusEl.classList.add('offline');
        statusEl.classList.remove('online');
        dotEl.title = 'Offline';
    }
}

/**
 * Check all services health
 */
async function checkAllServices() {
    const checks = Object.entries(SERVICES).map(([id, config]) =>
        checkServiceHealth(id, config)
    );
    await Promise.all(checks);
}

/**
 * Copy code to clipboard
 */
function copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const codeEl = codeBlock.querySelector('code');
    const text = codeEl.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        button.textContent = 'Failed';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    });
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Header scroll effect
 */
function initHeaderScroll() {
    const header = document.querySelector('header');
    if (!header) return;

    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    }, { passive: true });
}

/**
 * Animate elements on scroll
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.classList.add('fade-in');
        observer.observe(card);
    });

    // Observe steps
    document.querySelectorAll('.step').forEach(step => {
        step.classList.add('fade-in');
        observer.observe(step);
    });

    // Observe deploy cards
    document.querySelectorAll('.deploy-card').forEach(card => {
        card.classList.add('fade-in');
        observer.observe(card);
    });
}

// Make copyCode available globally
window.copyCode = copyCode;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initHeaderScroll();
    initScrollAnimations();

    // Check services immediately and then every 30 seconds
    checkAllServices();
    setInterval(checkAllServices, 30000);
});
