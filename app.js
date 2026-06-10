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
            createdDate: new Date().toISOString(),
            tags: [],
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
            const projectCard = document.createElement('div');
            projectCard.className = 'bg-white rounded-lg shadow-sm p-6';
            projectCard.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-semibold">${project.name}</h3>
                    <div class="flex space-x-2">
                        <button onclick="projectManager.showProjectModal(${JSON.stringify(project)})"
                            class="text-blue-500 hover:text-blue-600">Edit</button>
                        <button onclick="projectManager.deleteProject('${project.id}')"
                            class="text-red-500 hover:text-red-600">Delete</button>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500" style="width: ${project.progress}%"></div>
                    </div>
                    <div class="text-sm text-gray-600 mt-1">${project.progress}% completed</div>
                </div>
                <div class="mb-4 text-gray-600">${project.description}</div>
                <div class="bg-gray-50 p-3 rounded">
                    <h4 class="font-semibold mb-2">Scaling Tips:</h4>
                    <div class="text-gray-600">${project.scalingTips}</div>
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

const projectManager = new ProjectManager();// JavaScript for hero section interactions
document.addEventListener('DOMContentLoaded', function() {
    const ctaPrimary = document.getElementById('ctaPrimary');
    const ctaSecondary = document.getElementById('ctaSecondary');
    
    ctaPrimary.addEventListener('click', function() {
        // Scroll to projects section
        document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
    });
    
    ctaSecondary.addEventListener('click', function() {
        // Open demo modal or video
        alert('Demo video would play here');
    });

    // Add animation classes on load
    setTimeout(() => {
        document.querySelectorAll('.floating-badge').forEach((badge, index) => {
            badge.style.animationDelay = `${index * 0.2}s`;
            badge.classList.add('animate-fade-in');
        });
    }, 300);
});
