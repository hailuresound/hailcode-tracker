class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentSort = null;
        this.sortAsc = true;
        this.lastProjectsState = null;
        this.undoTimer = null;
    }

    init() {
        console.log('ProjectManager init');
        this.loadProjects();
        this.syncDefaultProject();
        this.setupSessionModal();

        const addBtn = document.getElementById('addProjectBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const closeBtn = document.getElementById('closeModalBtn');
        const modal = document.getElementById('projectModal');
        const form = document.getElementById('projectForm');

        if (!addBtn || !cancelBtn || !closeBtn || !modal || !form) {
            console.error('Missing DOM elements for modal');
            return;
        }

        addBtn.addEventListener('click', () => this.showProjectModal());

        cancelBtn.addEventListener('click', () => {
            console.log('Cancel clicked');
            modal.classList.add('hidden');
        });

        closeBtn.addEventListener('click', () => {
            console.log('X close clicked');
            modal.classList.add('hidden');
        });

        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
        }

        modal.addEventListener('click', (e) => {
            console.log('Overlay click, target === currentTarget:', e.target === e.currentTarget);
            if (e.target === e.currentTarget) {
                modal.classList.add('hidden');
            }
        });

        form.addEventListener('submit', (e) => this.handleFormSubmit(e));

        this.runMigrations();
        this.setupDarkMode();
        this.setupSettingsModal();
        this.setupSortControls();
        this.setupViewToggle();
        this.setupQuickSession();
        this.setupKanbanDragDrop();

        console.log('ProjectManager init complete');
    }

    getKanbanStatus(project) {
        if (project.kanbanStatus) return project.kanbanStatus;
        const progress = project.progress ?? 0;
        if (progress >= 100) return 'completed';
        if (progress >= 70) return 'review';
        if (progress >= 20) return 'in-progress';
        return 'backlog';
    }

    setupQuickSession() {
        const quickBtn = document.getElementById('quickSessionBtn');
        if (!quickBtn) return;

        quickBtn.addEventListener('click', () => {
            // Default to the HAILCODE Tracker project if it exists
            const defaultProject = this.projects.find(p => p.id === 'hailcode-tracker');
            if (defaultProject) {
                this.showSessionModal(defaultProject);
            } else if (this.projects.length > 0) {
                // Fallback to the first project
                this.showSessionModal(this.projects[0]);
            }
        });
    }

    setupViewToggle() {
        const viewBtns = document.querySelectorAll('.view-btn');
        const listView = document.getElementById('projectsList');
        const kanbanView = document.getElementById('kanbanBoard');

        if (!viewBtns.length || !listView || !kanbanView) return;

        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (btn.dataset.view === 'kanban') {
                    listView.classList.add('hidden');
                    kanbanView.classList.remove('hidden');
                    this.renderKanbanBoard();
                } else {
                    listView.classList.remove('hidden');
                    kanbanView.classList.add('hidden');
                    this.renderProjects();
                }
            });
        });
    }

    setupSortControls() {
        const sortField = document.getElementById('sortField');
        const sortToggle = document.getElementById('sortDirection');

        if (!sortField || !sortToggle) {
            console.error('Missing sort control elements');
            return;
        }

        sortField.addEventListener('change', () => {
            this.sortProjects(sortField.value, this.sortAsc);
        });

        sortToggle.addEventListener('click', () => {
            this.sortAsc = !this.sortAsc;
            sortToggle.textContent = this.sortAsc ? '↑' : '↓';
            this.sortProjects(sortField.value, this.sortAsc);
        });
    }

    setupSettingsModal() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
        const settingsForm = document.getElementById('settingsForm');
        const apiKeyInput = document.getElementById('apiKey');

        if (!settingsBtn || !settingsModal || !closeSettingsBtn || !cancelSettingsBtn || !settingsForm || !apiKeyInput) {
            console.error('Missing DOM elements for settings modal');
            return;
        }

        const savedKey = localStorage.getItem('openRouterApiKey');
        if (savedKey) {
            apiKeyInput.value = savedKey;
        }

        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        cancelSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        const settingsContent = settingsModal.querySelector('.modal-content');
        if (settingsContent) {
            settingsContent.addEventListener('click', (e) => e.stopPropagation());
        }
        settingsModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                settingsModal.classList.add('hidden');
            }
        });

        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const key = apiKeyInput.value.trim();
            if (key) {
                localStorage.setItem('openRouterApiKey', key);
                settingsModal.classList.add('hidden');
                console.log('API key saved');
            }
        });

        if (!savedKey) {
            setTimeout(() => {
                settingsModal.classList.remove('hidden');
            }, 1000);
        }
    }

    setupSessionModal() {
        const sessionModal = document.getElementById('sessionModal');
        const closeSessionBtn = document.getElementById('closeSessionBtn');
        const cancelSessionBtn = document.getElementById('cancelSessionBtn');
        const sessionForm = document.getElementById('sessionForm');

        if (!sessionModal || !closeSessionBtn || !cancelSessionBtn || !sessionForm) {
            console.error('Missing DOM elements for session modal');
            return;
        }

        closeSessionBtn.addEventListener('click', () => {
            sessionModal.classList.add('hidden');
        });

        cancelSessionBtn.addEventListener('click', () => {
            sessionModal.classList.add('hidden');
        });

        const sessionContent = sessionModal.querySelector('.modal-content');
        if (sessionContent) {
            sessionContent.addEventListener('click', (e) => e.stopPropagation());
        }
        sessionModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                sessionModal.classList.add('hidden');
            }
        });

        sessionForm.addEventListener('submit', (e) => this.handleSessionSubmit(e));
    }

    formatDuration(totalMinutes) {
        if (!totalMinutes || totalMinutes <= 0) return '0h';
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}m`;
    }

    runMigrations() {
        const flag = localStorage.getItem('migration_brandHubSessionFix');
        if (flag === 'done') return;

        // Seed correct sessions for hailcode-tracker
        const tracker = this.projects.find(p => p.id === 'hailcode-tracker');
        if (tracker) {
            if (!tracker.sessions) tracker.sessions = [];
            const hasJun11 = tracker.sessions.some(s => s.date === '2026-06-11');
            const hasJun13 = tracker.sessions.some(s => s.date === '2026-06-13');
            tracker.sessions = tracker.sessions.filter(s =>
                s.date !== '2026-06-11' && s.date !== '2026-06-13'
            );
            if (!hasJun11) {
                tracker.sessions.push({ id: Date.now() + 1, date: '2026-06-11', duration: 120, notes: 'Initial build. Project cards, progress tracking, priority/status badges, AI Insights via OpenRouter, session logging, illustration assets.' });
            }
            if (!hasJun13) {
                tracker.sessions.push({ id: Date.now() + 2, date: '2026-06-13', duration: 30, notes: 'Fixed ._filename prefix blocking GitHub Pages deployment. Added ._* to .gitignore. Seed data corrections for cross-browser consistency.' });
            }
        }

        // Seed correct sessions for hailure-brand-hub
        const brandHub = this.projects.find(p => p.id === 'hailure-brand-hub');
        if (brandHub) {
            if (!brandHub.sessions) brandHub.sessions = [];
            const hasJun12 = brandHub.sessions.some(s => s.date === '2026-06-12');
            const hasJun13 = brandHub.sessions.some(s => s.date === '2026-06-13');
            brandHub.sessions = brandHub.sessions.filter(s =>
                s.date !== '2026-06-12' && s.date !== '2026-06-13'
            );
            if (!hasJun12) {
                brandHub.sessions.push({ id: Date.now() + 3, date: '2026-06-12', duration: 150, notes: 'Initial build sprint. IndexedDB + Dexie.js, board nesting, breadcrumbs, dark/light mode, freeform canvas 5000x4000px, pan + card drag, batch upload, folder upload, masonry>canvas migration, auto-grid, Re-grid button, rubber-band multi-select, group drag, bulk delete toolbar, minimap with real-time viewport indicator, image lightbox with keyboard nav, inline asset rename, Finder drag-drop, HTML export, JSON backup.' });
            }
            if (!hasJun13) {
                brandHub.sessions.push({ id: Date.now() + 4, date: '2026-06-13', duration: 90, notes: 'Bug fixes and polish. Minimap lag fixed (two-layer canvas rendering), rubber-band coordinate space fix, selection flash fix, bulk delete confirmation toolbar, re-grid spacing tightened, duplicate asset cleanup, fit button, tracker migration.' });
            }
        }

        // Clear any remaining mislogged 2h 30m session from artist website
        const artistWebsite = this.projects.find(p => p.id === 'hailure-artist-website');
        if (artistWebsite) {
            artistWebsite.sessions = (artistWebsite.sessions || []).filter(s =>
                !(s.date === '2026-06-12' && s.duration === 150)
            );
        }

        this.saveProjects();
        localStorage.setItem('migration_brandHubSessionFix', 'done');
        console.log('Migration brandHubSessionFix applied');
    }

    syncDefaultProject() {
        const seedProjects = [
            {
                id: 'hailcode-tracker',
                name: 'HAILCODE Tracker',
                description: 'A personal vibe coding project tracker built under the HAILCODE brand. Stack: vanilla HTML/CSS/JS. Features so far: project cards, progress tracking, priority tags, AI Insights panel, session logging, Kanban board view, forest-gold visual theme. Live demo: https://hailuresound.github.io/hailcode-tracker/\n\nRoadmap Features:\n- Project archiving system\n- Burndown charts for sprint tracking\n- Cross-session dark mode sync\n\nTroubleshooting Focus Areas:\n- Session time calculation accuracy\n- Drag-and-drop boundary cases\n- Mobile viewports under 320px',
                progress: 70,
                priority: 'medium',
                tags: ['productivity', 'tool'],
                dueDate: null,
            },
            {
                id: 'hailure-artist-website',
                name: 'Hailure Artist Website',
                description: 'Brand website for Hailure. Features: artist bio, discography, shop with Stripe integration for digital and physical products.',
                progress: 50,
                priority: 'high',
                tags: ['web', 'hailure', 'stripe', 'ecommerce'],
                dueDate: null,
            },
            {
                id: 'summonr',
                name: 'SUMMONR',
                description: 'Multi-FX plugin. Previously developed in Claude Code. To be continued.',
                progress: 5,
                priority: 'high',
                tags: ['plugin', 'dsp', 'audio', 'juce'],
                dueDate: null,
            },
            {
                id: 'hailure-artist-board',
                name: 'Hailure Artist Board',
                description: 'Replacement for Milanote board. Visual organiser for artist project thoughts, mood boards, and creative direction.',
                progress: 0,
                priority: 'medium',
                tags: ['tool', 'hailure', 'organisation'],
                dueDate: null,
            },
            {
                id: 'phsR',
                name: 'PHSR',
                description: 'New audio plugin — phaser/flanger/comb filter/chorus/unison hybrid effect.',
                progress: 0,
                priority: 'medium',
                tags: ['plugin', 'dsp', 'audio', 'juce'],
                dueDate: null,
            },
            {
                id: 'hailure-brand-hub',
                name: 'Hailure Brand Hub',
                description: 'Milanote-inspired brand asset management dashboard. Features: freeform spatial canvas, board nesting, multi-select + group drag, minimap, image lightbox, inline rename, Finder drag-drop, HTML export, JSON backup.',
                progress: 82,
                priority: 'medium',
                tags: ['tool', 'hailure', 'brand'],
                dueDate: null,
            },
        ];

        seedProjects.forEach(seed => {
            const existingIndex = this.projects.findIndex(p => p.id === seed.id);

            if (existingIndex === -1) {
                this.projects.push({
                    ...seed,
                    createdDate: new Date().toISOString(),
                    sessions: []
                });
                console.log(`Seed project "${seed.name}" created`);
            } else {
                const original = this.projects[existingIndex];
                this.projects[existingIndex] = {
                    ...seed,
                    createdDate: original.createdDate,
                    sessions: original.sessions || [],
                    dueDate: original.dueDate || null,
                };
                console.log(`Seed project "${seed.name}" synced`);
            }
        });

        this.saveProjects();
        this.renderProjects();
    }

    setupDarkMode() {
        const toggle = document.getElementById('darkModeToggle');
        if (!toggle) {
            console.error('Dark mode toggle not found');
            return;
        }

        const storedDarkMode = localStorage.getItem('darkMode');
        const isDark = storedDarkMode !== 'false';
        document.body.classList.toggle('dark', isDark);
        toggle.checked = isDark;

        toggle.addEventListener('change', () => {
            const isChecked = toggle.checked;
            document.body.classList.toggle('dark', isChecked);
            localStorage.setItem('darkMode', isChecked);
            console.log('Dark mode:', isChecked ? 'on' : 'off');
        });
    }

    sortProjects(field, ascending = true) {
        this.projects.sort((a, b) => {
            let comparison = 0;

            if (field === 'date') {
                comparison = new Date(a.createdDate) - new Date(b.createdDate);
            } else if (field === 'progress') {
                comparison = (a.progress ?? 0) - (b.progress ?? 0);
            } else if (field === 'priority') {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
            } else if (field === 'name') {
                comparison = (a.name || '').localeCompare(b.name || '');
            } else if (field === 'status') {
                const getStatusOrder = (p) => {
                    const progress = p.progress ?? 0;
                    if (progress < 30) return 1;
                    if (progress < 70) return 2;
                    return 3;
                };
                comparison = getStatusOrder(a) - getStatusOrder(b);
            }

            return ascending ? comparison : -comparison;
        });
        this.renderProjects();
    }

    getDeadlineInfo(dueDate) {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isOverdue = diffMs < 0;
        const isToday = diffDays === 0;
        return { diffDays, isOverdue, isToday };
    }

    getCountdownText(dueDate) {
        if (!dueDate) return 'No deadline';
        const info = this.getDeadlineInfo(dueDate);
        if (!info) return 'No deadline';
        if (info.isOverdue) {
            const absDays = Math.abs(info.diffDays);
            return `🚨 Overdue by ${absDays} day${absDays === 1 ? '' : 's'}`;
        }
        if (info.isToday) return '⚠️ Due Today';
        if (info.diffDays <= 7) {
            return `${info.diffDays} day${info.diffDays === 1 ? '' : 's'} left`;
        }
        const weeks = Math.ceil(info.diffDays / 7);
        return `${weeks} week${weeks === 1 ? '' : 's'} left`;
    }

    formatDueDate(dueDate) {
        if (!dueDate) return '';
        const info = this.getDeadlineInfo(dueDate);
        if (!info) return '';
        const dateStr = new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (info.isOverdue) return `Overdue by ${Math.abs(info.diffDays)} day${Math.abs(info.diffDays) === 1 ? '' : 's'} (${dateStr})`;
        if (info.isToday) return `Due Today (${dateStr})`;
        if (info.diffDays <= 3) return `Due in ${info.diffDays} day${info.diffDays === 1 ? '' : 's'} (${dateStr})`;
        return `Due ${dateStr}`;
    }

    getDueDateClass(dueDate) {
        if (!dueDate) return '';
        const info = this.getDeadlineInfo(dueDate);
        if (!info) return '';
        if (info.isOverdue) return 'deadline-overdue';
        if (info.isToday || info.diffDays <= 3) return 'deadline-soon';
        return 'deadline-future';
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const existingProject = form.projectId.value ? this.projects.find(p => p.id === form.projectId.value) : null;
        const dueDateRaw = document.getElementById('projectDueDate').value;
        const projectData = {
            id: form.projectId.value || Date.now().toString(),
            name: form.projectName.value,
            progress: parseInt(form.projectProgress.value),
            description: form.projectDescription.value,
            createdDate: existingProject ? existingProject.createdDate : new Date().toISOString(),
            dueDate: dueDateRaw || null,
            tags: form.projectTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
            priority: form.projectPriority.value || 'medium',
            sessions: existingProject ? (existingProject.sessions || []) : [],
        };

        if (form.projectId.value) {
            const index = this.projects.findIndex(p => p.id === projectData.id);
            this.projects[index] = projectData;
        } else {
            this.projects.push(projectData);
        }

        this.saveProjects();
        this.renderProjects();
        this.hideProjectModal();
    }

    handleSessionSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const projectId = document.getElementById('sessionProjectId').value;
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        if (!project.sessions) project.sessions = [];

        project.sessions.push({
            id: Date.now(),
            date: document.getElementById('sessionDate').value,
            duration: parseInt(document.getElementById('sessionDuration').value),
            notes: document.getElementById('sessionNotes').value.trim(),
        });

        this.saveProjects();
        this.renderProjects();

        // Close modal
        document.getElementById('sessionModal').classList.add('hidden');
        form.reset();
    }

    showSessionModal(project) {
        const modal = document.getElementById('sessionModal');
        document.getElementById('sessionProjectId').value = project.id;
        document.getElementById('sessionDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('sessionDuration').value = '';
        document.getElementById('sessionNotes').value = '';
        modal.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('sessionDuration')?.focus();
        }, 100);
    }

    async analyseProject(project) {
        const insightsEl = document.getElementById(`insights-${project.id}`);
        if (!insightsEl) return;

        const apiKey = localStorage.getItem('openRouterApiKey');
        if (!apiKey) {
            document.getElementById('settingsModal').classList.remove('hidden');
            insightsEl.value = "⚠️ Please add your OpenRouter API key in Settings";
            return;
        }

        const button = insightsEl.nextElementSibling;
        button.disabled = true;
        button.textContent = "Analyzing...";
        insightsEl.value = "Generating AI insights...";

        try {
            // Build deadline context
            const projectsWithDeadlines = this.projects
                .filter(p => p.dueDate)
                .map(p => {
                    const info = this.getDeadlineInfo(p.dueDate);
                    return `${p.name} (Due: ${new Date(p.dueDate).toLocaleDateString()}, ${info.isOverdue ? 'OVERDUE by ' + Math.abs(info.diffDays) + ' days' : info.diffDays + ' days remaining'}, Progress: ${p.progress || 0}%)`;
                });

            const deadlineSummary = projectsWithDeadlines.length > 0
                ? `\n\nAll projects with deadlines:\n${projectsWithDeadlines.join('\n')}`
                : '\n\nNo projects currently have deadlines set.';

            const thisProjectDeadline = project.dueDate
                ? (() => {
                    const info = this.getDeadlineInfo(project.dueDate);
                    return ` (Due: ${new Date(project.dueDate).toLocaleDateString()}, ${info.isOverdue ? 'OVERDUE by ' + Math.abs(info.diffDays) + ' days' : info.diffDays + ' days remaining'})`;
                  })()
                : ' (No deadline set)';

            const prompt = `Act as a strategic project advisor. Analyze this project in the context of all active deadlines and provide time-sensitive recommendations.

PROJECT:
Name: ${project.name}${thisProjectDeadline}
Description: ${project.description}
Progress: ${project.progress}%
Priority: ${project.priority}
Tags: ${project.tags?.length ? project.tags.join(', ') : 'none'}
Total time logged: ${this.formatDuration((project.sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0))}

DEADLINE OVERVIEW:
${deadlineSummary}

Based on ALL deadline information, provide:
1. **Deadline Assessment**: Is this project on track to meet its deadline? If overdue, what's the damage and recovery strategy?
2. **Time Allocation**: How should I divide my next coding sessions between this project and others given their relative deadlines and priorities?
3. **Strategic Next Steps**: 2-3 focused, actionable steps specific to this project's timeline.

Be direct and practical. Flag any projects that are overdue or approaching their deadline soon.`;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat",
                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            insightsEl.value = content || "No analysis generated. The model returned an empty response.";
        } catch (error) {
            console.error('Analyse project error:', error);
            insightsEl.value = `Error generating insights: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = "Analyse Project";
        }
    }

    renderKanbanBoard() {
        const columns = ['backlog', 'in-progress', 'review', 'completed'];
        const columnNames = {
            backlog: '📋 Backlog',
            'in-progress': '🔧 In Progress',
            review: '👁️ Review',
            completed: '✅ Completed'
        };

        // Count projects per column
        const counts = {};
        columns.forEach(col => counts[col] = 0);

        columns.forEach(status => {
            const body = document.getElementById(`column-${status}`);
            if (!body) return;
            body.innerHTML = '';

            const projectsInColumn = this.projects.filter(p => this.getKanbanStatus(p) === status);
            counts[status] = projectsInColumn.length;

            if (projectsInColumn.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'kanban-empty';
                empty.textContent = 'Drop projects here';
                body.appendChild(empty);
            }

            projectsInColumn.forEach(project => {
                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.draggable = true;
                card.dataset.projectId = project.id;

                const progress = project.progress ?? 0;

                // Deadline info for card
                let deadlineHtml = '';
                if (project.dueDate) {
                    const info = this.getDeadlineInfo(project.dueDate);
                    let deadlineClass = '';
                    if (info && info.isOverdue) deadlineClass = 'overdue';
                    else if (info && (info.isToday || info.diffDays <= 3)) deadlineClass = 'soon';
                    const countdownText = this.getCountdownText(project.dueDate);
                    if (countdownText && countdownText !== 'No deadline') {
                        deadlineHtml = `<div class="kanban-card-deadline ${deadlineClass}">📅 ${countdownText}</div>`;
                    }
                }

                card.innerHTML = `
                    <h4 class="kanban-card-title">${project.name}</h4>
                    <div class="kanban-card-meta">
                        <span class="kanban-card-priority ${project.priority}">${project.priority}</span>
                        <span class="kanban-card-progress">${progress}%</span>
                    </div>
                    <div class="kanban-card-progress-bar">
                        <div class="kanban-card-progress-fill" style="width:${progress}%"></div>
                    </div>
                    ${deadlineHtml}
                `;

                // Drag events
                card.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', project.id);
                    e.dataTransfer.effectAllowed = 'move';
                    card.classList.add('dragging');
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    document.querySelectorAll('.kanban-column').forEach(col => {
                        col.classList.remove('drag-over');
                    });
                });

                // Double-click to edit
                card.addEventListener('dblclick', () => {
                    this.showProjectModal(project);
                });

                body.appendChild(card);
            });
        });

        // Update counts
        columns.forEach(status => {
            const countEl = document.getElementById(`count-${status}`);
            if (countEl) countEl.textContent = counts[status];
        });
    }

    setupKanbanDragDrop() {
        const board = document.getElementById('kanbanBoard');
        if (!board) return;

        // Single event delegation on #kanbanBoard — survives re-renders
        board.addEventListener('dragover', (e) => {
            const col = e.target.closest('.kanban-column');
            if (col) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');
            }
        });

        board.addEventListener('dragleave', (e) => {
            const col = e.target.closest('.kanban-column');
            if (col) {
                col.classList.remove('drag-over');
            }
        });

        board.addEventListener('drop', (e) => {
            e.preventDefault();
            // Remove drag-over from all columns
            document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));

            const col = e.target.closest('.kanban-column');
            if (!col) return;

            const projectId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;

            if (!projectId || !newStatus) return;

            const project = this.projects.find(p => p.id === projectId);
            if (!project) return;

            const currentStatus = this.getKanbanStatus(project);
            if (currentStatus === newStatus) return;

            // Snapshot state before modifying
            this.lastProjectsState = JSON.parse(JSON.stringify(this.projects));

            // Update kanban status and progress percentage
            project.kanbanStatus = newStatus;

            // Set progress based on target column thresholds
            // Using explicit thresholds: In Progress=50%, Review=75%, Completed=100%
            if (newStatus === 'completed') {
                project.progress = 100;
            } else if (newStatus === 'review') {
                project.progress = Math.max(project.progress, 75);
            } else if (newStatus === 'in-progress') {
                project.progress = Math.max(project.progress, 50);
            } else if (newStatus === 'backlog') {
                if (project.progress >= 20) {
                    project.progress = 10;
                }
            }

            this.saveProjects();
            this.renderKanbanBoard();
            this.renderProjects();
            this.showUndoNotification();
        });
    }

    renderProjects() {
        const projectsList = document.getElementById('projectsList');
        if (!projectsList) return;
        projectsList.innerHTML = '';

        this.projects.forEach(project => {
            const progress = project.progress ?? 0;

            let badgeClass = 'badge-on-track';
            let statusText = 'On Track';
            if (progress < 30) {
                badgeClass = 'badge-needs-attention';
                statusText = 'Needs Attention';
            } else if (progress < 70) {
                badgeClass = 'badge-in-progress';
                statusText = 'In Progress';
            }

            const escapedId = project.id.replace(/'/g, "\\'");
            const sessions = project.sessions || [];
            const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            const totalFormatted = this.formatDuration(totalMinutes);

            // Build session timeline HTML
            const sortedSessions = [...sessions].sort((a, b) => b.id - a.id);
            let sessionListHtml = '';
            if (sortedSessions.length === 0) {
                sessionListHtml = '<p class="session-empty">No sessions logged yet.</p>';
            } else {
                sessionListHtml = '<ul class="session-list">';
                sortedSessions.forEach(s => {
                    const formattedDuration = this.formatDuration(s.duration);
                    sessionListHtml += `
                        <li class="session-item">
                            <div class="session-item-header">
                                <span class="session-item-date">${new Date(s.date).toLocaleDateString()}</span>
                                <span class="session-item-duration">${formattedDuration}</span>
                            </div>
                            ${s.notes ? `<div class="session-item-notes">${s.notes}</div>` : ''}
                        </li>
                    `;
                });
                sessionListHtml += '</ul>';
            }

            const projectCard = document.createElement('div');
            projectCard.className = 'project-card animate-fade-in';
            projectCard.innerHTML = `
                <div class="project-card-header">
                    <div>
                        <h3 class="card-title">${project.name}</h3>
                        <div class="project-card-meta">
                            <span class="priority-${project.priority}">
                                ${project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
                            </span>
                            ${project.tags?.length ? `
                                ${project.tags.map(tag => `
                                    <span class="tag">${tag}</span>
                                `).join('')}
                            ` : ''}
                        </div>
                    </div>
                    <div class="project-card-actions">
                        <span class="badge ${badgeClass}">${statusText}</span>
                        <button data-action="edit" data-id="${escapedId}" class="action-link">Edit</button>
                        <button data-action="delete" data-id="${escapedId}" class="action-link action-link-danger">Delete</button>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-label">
                        <span>${progress}% completed</span>
                        <span>Created ${new Date(project.createdDate).toLocaleDateString()}</span>
                    </div>
                    <div class="session-total">Total: ${totalFormatted}</div>
                    ${project.dueDate ? `
                    <div class="deadline-row ${this.getDueDateClass(project.dueDate)}">
                        <span class="deadline-icon">📅</span>
                        <span class="deadline-text">${this.getCountdownText(project.dueDate)}</span>
                    </div>
                    ` : ''}
                </div>
                <p class="mb-4">${project.description}</p>
                <div class="session-section">
                    <details class="session-details">
                        <summary>
                            <span class="session-header">Sessions</span>
                        </summary>
                        <div class="session-body">
                            ${sessionListHtml}
                            <button data-action="log-session" data-id="${escapedId}" class="btn btn-sm" style="margin-top:0.625rem;">Log Session</button>
                        </div>
                    </details>
                </div>
                <div class="ai-insights">
                    <details class="ai-insights-details">
                        <summary>
                            <span class="ai-insights-header">AI Insights</span>
                        </summary>
                        <div class="ai-insights-body">
                            <label class="ai-insights-label" for="insights-${project.id}">Analysis & recommendations for this project</label>
                            <textarea id="insights-${project.id}" class="ai-insights-textarea" readonly placeholder="Click 'Analyse Project' to generate insights...">${project.aiInsights || ''}</textarea>
                            <button data-action="analyse" data-project='${JSON.stringify(project).replace(/'/g, "&#39;")}' class="btn btn-sm">Analyse Project</button>
                        </div>
                    </details>
                </div>
            `;

            const cornerImg = document.createElement('img');
            cornerImg.src = 'assets/illustrations/flair3corner.png';
            cornerImg.className = 'corner-flair';
            cornerImg.alt = '';
            projectCard.appendChild(cornerImg);

            const editBtn = projectCard.querySelector('[data-action="edit"]');
            const deleteBtn = projectCard.querySelector('[data-action="delete"]');
            const analyseBtn = projectCard.querySelector('[data-action="analyse"]');
            const logSessionBtn = projectCard.querySelector('[data-action="log-session"]');

            editBtn.addEventListener('click', () => this.showProjectModal(project));
            deleteBtn.addEventListener('click', () => this.deleteProject(project.id));
            analyseBtn.addEventListener('click', () => this.analyseProject(project));
            logSessionBtn.addEventListener('click', () => this.showSessionModal(project));

            projectsList.appendChild(projectCard);
        });
    }

    showUndoNotification() {
        // Clear any existing timer
        if (this.undoTimer) {
            clearTimeout(this.undoTimer);
            const existingToast = document.getElementById('undo-toast');
            if (existingToast) existingToast.remove();
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'undo-toast';

        const msg = document.createElement('span');
        msg.textContent = 'Card moved. ';

        const undoBtn = document.createElement('button');
        undoBtn.textContent = 'Undo';
        undoBtn.className = 'undo-btn';

        undoBtn.addEventListener('click', () => {
            if (this.lastProjectsState) {
                this.projects = this.lastProjectsState;
                this.lastProjectsState = null;
                this.saveProjects();
                this.renderKanbanBoard();
                this.renderProjects();
            }
            toast.remove();
            if (this.undoTimer) {
                clearTimeout(this.undoTimer);
                this.undoTimer = null;
            }
        });

        toast.appendChild(msg);
        toast.appendChild(undoBtn);
        document.body.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => toast.classList.add('undo-toast-visible'));

        // Auto-dismiss after 5 seconds
        this.undoTimer = setTimeout(() => {
            toast.classList.remove('undo-toast-visible');
            setTimeout(() => toast.remove(), 300);
            this.undoTimer = null;
        }, 5000);
    }

    deleteProject(id) {
        const isDefault = id === 'hailcode-tracker';
        if (isDefault && !confirm('Remove the default HAILCODE Tracker project from the list?')) {
            return;
        }
        this.projects = this.projects.filter(project => project.id !== id);
        this.saveProjects();
        this.renderProjects();
    }

    saveProjects() {
        localStorage.setItem('projects', JSON.stringify(this.projects));
    }

    loadProjects() {
        const savedProjects = localStorage.getItem('projects');
        this.projects = savedProjects ? JSON.parse(savedProjects) : [];
        // Ensure all projects have required fields (migration for existing data)
        this.projects.forEach(p => {
            if (!p.sessions) p.sessions = [];
            if (!p.dueDate) p.dueDate = null;
        });
        this.renderProjects();
    }

    showProjectModal(project) {
        const modal = document.getElementById('projectModal');
        modal.classList.remove('hidden');
        if (project) {
            document.getElementById('projectId').value = project.id;
            document.getElementById('projectName').value = project.name;
            document.getElementById('projectProgress').value = project.progress;
            document.getElementById('projectDescription').value = project.description;
            document.getElementById('projectPriority').value = project.priority;
            document.getElementById('projectDueDate').value = project.dueDate || '';
            document.getElementById('projectTags').value = project.tags?.join(', ') || '';
        } else {
            document.getElementById('projectForm').reset();
            document.getElementById('projectId').value = '';
        }
        setTimeout(() => {
            document.getElementById('projectName')?.focus();
        }, 100);
    }

    hideProjectModal() {
        console.log('hideProjectModal called');
        const modal = document.getElementById('projectModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready, initializing ProjectManager');
    window.projectManager = new ProjectManager();
    window.projectManager.init();
});