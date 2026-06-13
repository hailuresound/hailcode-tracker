// Hailure Artist Board - Interactive Features

const App = {
    // Gallery data
    galleryItems: [
        { id: 1, title: 'Neon Dusk', category: 'digital', emoji: '🌆', description: 'Digital painting exploring neon aesthetics in urban landscapes.' },
        { id: 2, title: 'Fractal Bloom', category: 'illustration', emoji: '🌸', description: 'Generative illustration combining organic forms with geometric patterns.' },
        { id: 3, title: 'Sonic Waves', category: 'design', emoji: '🌊', description: 'Album art design translating audio frequencies into visual compositions.' },
        { id: 4, title: 'Chrome Cathedral', category: 'digital', emoji: '🏛️', description: 'Architectural digital study of light and reflection on metallic surfaces.' },
        { id: 5, title: 'Dark Flora', category: 'illustration', emoji: '🌿', description: 'Botanical illustration with a dark, surrealist twist.' },
        { id: 6, title: 'Grid Theory', category: 'design', emoji: '🔲', description: 'Minimalist poster series exploring grid-based typographic systems.' },
        { id: 7, title: 'Pulse', category: 'digital', emoji: '💫', description: 'Abstract digital animation still capturing motion and energy.' },
        { id: 8, title: 'Void Walker', category: 'illustration', emoji: '👁️', description: 'Character design for a conceptual video game universe.' },
        { id: 9, title: 'Signal Loss', category: 'design', emoji: '📡', description: 'Brand identity project exploring glitch and distortion aesthetics.' },
    ],

    // DOM references
    els: {},

    // State
    state: {
        filter: 'all',
        theme: 'dark',
        animated: false,
    },

    init() {
        // Cache DOM elements
        this.els = {
            galleryGrid: document.getElementById('galleryGrid'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            navLinks: document.querySelectorAll('.nav-link'),
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.querySelector('.theme-icon'),
            contactForm: document.getElementById('contactForm'),
            toast: document.getElementById('toast'),
            statProjects: document.getElementById('statProjects'),
            statPieces: document.getElementById('statPieces'),
            statExhibitions: document.getElementById('statExhibitions'),
        };

        // Load saved theme
        this.loadTheme();

        // Render gallery
        this.renderGallery();

        // Bind events
        this.bindEvents();

        // Animate stats on scroll
        this.setupScrollObserver();
    },

    renderGallery(filter = 'all') {
        const items = filter === 'all'
            ? this.galleryItems
            : this.galleryItems.filter(item => item.category === filter);

        if (!this.els.galleryGrid) return;

        this.els.galleryGrid.innerHTML = items.map(item => `
            <div class="gallery-item fade-in" data-category="${item.category}" data-id="${item.id}">
                <div class="gallery-item-inner">
                    <div class="gallery-item-placeholder">${item.emoji}</div>
                    <h3 class="gallery-item-title">${item.title}</h3>
                    <span class="gallery-item-category">${item.category}</span>
                </div>
                <div class="gallery-item-overlay">
                    <span>${item.description}</span>
                </div>
            </div>
        `).join('');
    },

    bindEvents() {
        // Filter buttons
        this.els.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.els.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.dataset.filter;
                this.state.filter = filter;
                this.renderGallery(filter);
            });
        });

        // Navigation scroll + active state
        this.els.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').slice(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                this.els.navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Theme toggle
        this.els.themeToggle?.addEventListener('click', () => this.toggleTheme());

        // Contact form
        this.els.contactForm?.addEventListener('submit', (e) => this.handleContactSubmit(e));

        // Scroll spy for nav
        window.addEventListener('scroll', () => this.updateActiveNav());
    },

    toggleTheme() {
        document.body.classList.toggle('light');
        this.state.theme = document.body.classList.contains('light') ? 'light' : 'dark';
        this.els.themeIcon.textContent = this.state.theme === 'light' ? '☀️' : '🌙';
        localStorage.setItem('hailure-artist-theme', this.state.theme);
    },

    loadTheme() {
        const saved = localStorage.getItem('hailure-artist-theme');
        if (saved === 'light') {
            document.body.classList.add('light');
            this.state.theme = 'light';
            if (this.els.themeIcon) this.els.themeIcon.textContent = '☀️';
        } else {
            document.body.classList.remove('light');
            this.state.theme = 'dark';
            if (this.els.themeIcon) this.els.themeIcon.textContent = '🌙';
        }
    },

    handleContactSubmit(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('contactName').value,
            email: document.getElementById('contactEmail').value,
            message: document.getElementById('contactMessage').value,
        };

        // Simulate sending
        this.showToast('Message sent! I\'ll get back to you soon.');

        // Reset form
        this.els.contactForm.reset();
    },

    updateActiveNav() {
        const sections = ['gallery', 'about', 'contact'];
        let current = 'gallery';

        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 200) {
                    current = id;
                }
            }
        });

        this.els.navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
        });
    },

    animateStats() {
        if (this.state.animated) return;
        this.state.animated = true;

        const targets = [
            { el: this.els.statProjects, target: 12 },
            { el: this.els.statPieces, target: 47 },
            { el: this.els.statExhibitions, target: 3 },
        ];

        targets.forEach(({ el, target }) => {
            if (!el) return;
            let current = 0;
            const increment = Math.ceil(target / 30);
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                el.textContent = current;
            }, 40);
        });
    },

    setupScrollObserver() {
        const aboutSection = document.getElementById('about');
        if (!aboutSection || !('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateStats();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.3 });

        observer.observe(aboutSection);
    },

    showToast(message) {
        if (!this.els.toast) return;
        this.els.toast.textContent = message;
        this.els.toast.classList.add('visible');
        setTimeout(() => {
            this.els.toast.classList.remove('visible');
        }, 3000);
    },
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());