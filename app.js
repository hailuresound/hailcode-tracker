class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentSort = null;
    }

    init() {
        console.log('ProjectManager init');
        this.loadProjects();
        this.syncDefaultProject();

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

        // Fresh modal close implementation
        cancelBtn.addEventListener('click', () => {
            console.log('Cancel clicked');
            modal.classList.add('hidden');
        });

        closeBtn.addEventListener('click', () => {
            console.log('X close clicked');
            modal.classList.add('hidden');
        });

        // Overlay click: stop propagation on content, close on backdrop
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

        this.setupDarkMode();
        this.setupSettingsModal();

        document.getElementById('sortDateAsc').addEventListener('click', () => this.sortProjects('date'));
        document.getElementById('sortDateDesc').addEventListener('click', () => this.sortProjects('date', 'desc'));
        document.getElementById('sortPriorityAsc').addEventListener('click', () => this.sortProjects('priority'));
        document.getElementById('sortPriorityDesc').addEventListener('click', () => this.sortProjects('priority', 'desc'));

        console.log('ProjectManager init complete');
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

        // Pre-fill if key exists
        const savedKey = localStorage.getItem('openRouterApiKey');
        if (savedKey) {
            apiKeyInput.value = savedKey;
        }

        // Open settings
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });

        // Close via X
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        // Close via Cancel
        cancelSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        // Close via overlay click
        const settingsContent = settingsModal.querySelector('.modal-content');
        if (settingsContent) {
            settingsContent.addEventListener('click', (e) => e.stopPropagation());
        }
        settingsModal.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                settingsModal.classList.add('hidden');
            }
        });

        // Save key
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const key = apiKeyInput.value.trim();
            if (key) {
                localStorage.setItem('openRouterApiKey', key);
                settingsModal.classList.add('hidden');
                console.log('API key saved');
            }
        });

        // First-run prompt
        if (!savedKey) {
            setTimeout(() => {
                settingsModal.classList.remove('hidden');
            }, 1000);
        }
    }

    syncDefaultProject() {
        const defaultProject = {
            id: 'hailcode-tracker',
            name: 'HAILCODE Tracker',
            description: 'A personal vibe coding project tracker built under the HAILCODE brand. Stack: vanilla HTML/CSS/JS. Features so far: project cards, progress tracking, priority tags, AI Insights panel, forest-gold visual theme. Live demo: [GitHub Pages URL]',
            progress: 35,
            priority: 'medium',
            tags: ['productivity', 'tool'],
        };

        const existingIndex = this.projects.findIndex(p => p.id === defaultProject.id);

        if (existingIndex === -1) {
            // Add new with current date
            this.projects.push({
                ...defaultProject,
                createdDate: new Date().toISOString()
            });
            console.log('Default project seeded');
        } else {
            // Update existing while preserving original createdDate
            const originalCreatedDate = this.projects[existingIndex].createdDate;
            this.projects[existingIndex] = {
                ...defaultProject,
                createdDate: originalCreatedDate
            };
            console.log('Default project synced');
        }

        this.saveProjects();
        this.renderProjects();
    }

    setupDarkMode() {
        const toggle = document.getElementById('darkModeToggle');
        document.body.classList.add('dark');
        toggle.checked = true;

        toggle.addEventListener('change', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', toggle.checked);
        });

        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'false') {
            toggle.checked = false;
            document.body.classList.remove('dark');
        }
    }

    sortProjects(criteria, direction = 'asc') {
        this.projects.sort((a, b) => {
            if (criteria === 'date') {
                return direction === 'asc' ?
                    new Date(a.createdDate) - new Date(b.createdDate) :
                    new Date(b.createdDate) - new Date(a.createdDate);
            } else if (criteria === 'priority') {
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                return direction === 'asc' ?
                    priorityOrder[a.priority] - priorityOrder[b.priority] :
                    priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return 0;
        });
        this.renderProjects();
    }

    handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const projectData = {
            id: form.projectId.value || Date.now().toString(),
            name: form.projectName.value,
            progress: parseInt(form.projectProgress.value),
            description: form.projectDescription.value,
            createdDate: form.projectId.value ? this.projects.find(p => p.id === form.projectId.value).createdDate : new Date().toISOString(),
            tags: form.projectTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
            priority: form.projectPriority.value || 'medium',
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
            const prompt = `Act as a project advisor. Given the project details below, suggest what to focus on next to move this project forward.

Project Name: ${project.name}
Description: ${project.description}
Progress: ${project.progress}%
Priority: ${project.priority}
Tags: ${project.tags?.length ? project.tags.join(', ') : 'none'}

Provide 3 focused, actionable next steps for this project.`;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-v4-flash",
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
                </div>
                <p class="mb-4">${project.description}</p>
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

            const editBtn = projectCard.querySelector('[data-action="edit"]');
            const deleteBtn = projectCard.querySelector('[data-action="delete"]');
            const analyseBtn = projectCard.querySelector('[data-action="analyse"]');

            editBtn.addEventListener('click', () => this.showProjectModal(project));
            deleteBtn.addEventListener('click', () => this.deleteProject(project.id));
            analyseBtn.addEventListener('click', () => this.analyseProject(project));

            projectsList.appendChild(projectCard);
        });
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