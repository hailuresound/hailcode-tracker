class ProjectManager {
    constructor() {
        this.projects = [];
        this.currentSort = null;
        this.init();
    }

    init() {
        this.loadProjects();
        document.getElementById('addProjectBtn').addEventListener('click', () => this.showProjectModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideProjectModal());
        document.getElementById('projectForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.setupDarkMode();
        document.getElementById('sortDateAsc').addEventListener('click', () => this.sortProjects('date'));
        document.getElementById('sortDateDesc').addEventListener('click', () => this.sortProjects('date', 'desc'));
        document.getElementById('sortPriorityAsc').addEventListener('click', () => this.sortProjects('priority'));
        document.getElementById('sortPriorityDesc').addEventListener('click', () => this.sortProjects('priority', 'desc'));
    }

    setupDarkMode() {
        const toggle = document.getElementById('darkModeToggle');
        toggle.addEventListener('change', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('darkMode', toggle.checked);
        });

        const darkMode = localStorage.getItem('darkMode') === 'true';
        toggle.checked = darkMode;
        if (darkMode) document.body.classList.add('dark');
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
            scalingTips: form.projectScaling.value,
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

    renderProjects() {
        const projectsList = document.getElementById('projectsList');
        projectsList.innerHTML = '';

        this.projects.forEach(project => {
            const statusColor = project.progress < 30 ? 'red' : 
                              project.progress < 70 ? 'yellow' : 'green';
            const statusText = project.progress < 30 ? 'Needs Attention' : 
                             project.progress < 70 ? 'In Progress' : 'On Track';

            const projectCard = document.createElement('div');
            projectCard.className = 'bg-white dark:bg-gray-600 rounded-xl shadow-md p-6 transition-all duration-300 hover:-translate-y-1';
            projectCard.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-1">${project.name}</h3>
                        <div class="text-sm priority-${project.priority}">
                            ${project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
                        </div>
                        ${project.tags?.length ? `
                            <div class="flex flex-wrap gap-2 mt-1">
                                ${project.tags.map(tag => `
                                    <span class="px-2 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200">
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex space-x-2">
                        <span class="px-2 py-1 text-xs rounded-full bg-${statusColor}-100 text-${statusColor}-800 capitalize">
                            ${statusText}
                        </span>
                        <button onclick="projectManager.showProjectModal(${JSON.stringify(project)})"
                            class="text-blue-500 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200">
                            Edit
                        </button>
                        <button onclick="projectManager.deleteProject('${project.id}')"
                            class="text-red-500 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200">
                            Delete
                        </button>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="h-2 bg-gray-200 dark:bg-gray-500 rounded-full overflow-hidden">
                        <div class="h-full bg-${statusColor}-500" style="width: ${project.progress}%"></div>
                    </div>
                    <div class="flex justify-between text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <span>${project.progress}% completed</span>
                        <span>Created ${new Date(project.createdDate).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="mb-4 text-gray-600 dark:text-gray-300">${project.description}</div>
                <div class="bg-gray-50 dark:bg-gray-500 p-3 rounded">
                    <h4 class="font-semibold mb-2 text-gray-900 dark:text-white">Scaling Tips:</h4>
                    <div class="text-gray-600 dark:text-gray-200">${project.scalingTips}</div>
                </div>
            `;
            projectsList.appendChild(projectCard);
        });
    }

    deleteProject(id) {
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
}

const projectManager = new ProjectManager();

// Simplified initialization
document.addEventListener('DOMContentLoaded', function() {
    // Focus on first input when modal opens
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        setTimeout(() => {
            document.getElementById('projectName')?.focus();
        }, 100);
    });
});
