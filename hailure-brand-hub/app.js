// Hailure Brand Hub — Milanote-inspired artist brand dashboard

const App = (() => {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

    // State
    let state = {
        view: 'dashboard',
        currentBoardId: null,
        breadcrumb: [],
        theme: localStorage.getItem('hb-theme') || 'dark',
        objectURLs: [],
        paletteView: false,
        fontURLs: {},       // assetId -> createObjectURL for fonts
        // Canvas pan state
        canvasOffsetX: 0,
        canvasOffsetY: 0,
        isPanning: false,
        panStartX: 0,
        panStartY: 0,
        panStartOffX: 0,
        panStartOffY: 0,
        // Card drag state
        draggingCardEl: null,
        dragAssetId: null,
        dragStartMouseX: 0,
        dragStartMouseY: 0,
        dragStartCardX: 0,
        dragStartCardY: 0,
        // Temp position for new asset
        newAssetX: null,
        newAssetY: null,
    };

    // DOM refs
    const els = {};

    // Canvas dimensions
    const CANVAS_W = 5000;
    const CANVAS_H = 4000;

    // Supported file types
    const IMAGE_TYPES = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
    const FONT_TYPES = ['font/otf','font/ttf','font/woff','application/x-font-otf','application/x-font-ttf','application/font-sfnt'];
    const PDF_TYPES = ['application/pdf'];

    function isImage(mime, ext) {
        return IMAGE_TYPES.includes(mime) || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
    }
    function isFont(mime, ext) {
        return FONT_TYPES.includes(mime) || ['otf','ttf','woff'].includes(ext);
    }
    function isPDF(mime, ext) {
        return PDF_TYPES.includes(mime) || ext === 'pdf';
    }

    function extFromName(name) {
        return (name.split('.').pop() || '').toLowerCase();
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function init() {
        els.main = $('#mainContent');
        els.modalOverlay = $('#modalOverlay');
        els.modalContent = $('#modalContent');
        els.toast = $('#toast');
        els.themeBtn = $('#themeBtn');
        els.exportBtn = $('#exportBtn');
        els.importBtn = $('#importBtn');
        els.importInput = $('#importFileInput');

        if (state.theme === 'light') {
            document.body.classList.add('light');
            els.themeBtn.textContent = '\u2600\ufe0f';
        }

        els.themeBtn.addEventListener('click', toggleTheme);
        els.exportBtn.addEventListener('click', handleExport);
        els.importBtn.addEventListener('click', () => els.importInput.click());
        els.importInput.addEventListener('change', handleImport);
        els.modalOverlay.addEventListener('click', (e) => {
            if (e.target === els.modalOverlay) closeModal();
        });

        renderDashboard();
    }

    // ─── THEME ───

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('light');
        els.themeBtn.textContent = state.theme === 'light' ? '\u2600\ufe0f' : '\U0001f319';
        localStorage.setItem('hb-theme', state.theme);
    }

    // ─── NAVIGATION ───

    function navigateToBoard(boardId) {
        state.view = 'board';
        state.currentBoardId = boardId;
        state.paletteView = false;
        state.canvasOffsetX = 0;
        state.canvasOffsetY = 0;
        renderBoardView(boardId);
    }

    function navigateToDashboard() {
        state.view = 'dashboard';
        state.currentBoardId = null;
        state.breadcrumb = [];
        state.paletteView = false;
        renderDashboard();
    }

    // ─── DASHBOARD ───

    async function renderDashboard() {
        state.view = 'dashboard';
        state.currentBoardId = null;
        state.breadcrumb = [];

        const boards = await idb.getAllBoards();
        const rootBoards = boards.filter(b => !b.parentId);
        const counts = {};
        for (const b of boards) {
            const assets = await idb.getAssetsByBoard(b.id);
            counts[b.id] = assets.length;
        }

        els.main.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-header">
                    <h2>Brand Boards</h2>
                    <div class="board-actions">
                        <button onclick="App.showNewBoardModal()">+ New Board</button>
                    </div>
                </div>
                ${rootBoards.length === 0 ? `
                    <div class="empty-state">
                        <div class="icon">📋</div>
                        <p>No boards yet. Create your first brand board to get started.</p>
                    </div>
                ` : `
                    <div class="board-grid" id="boardGrid">
                        ${rootBoards.map(b => renderBoardCard(b, counts[b.id] || 0)).join('')}
                    </div>
                `}
            </div>
        `;

        if (rootBoards.length > 0) setupBoardDragDrop();
        updateNav();
    }

    function renderBoardCard(board, assetCount) {
        return `
            <div class="board-card" draggable="true" data-board-id="${board.id}">
                <div class="board-card-actions">
                    <button onclick="event.stopPropagation(); App.showEditBoardModal(${board.id})" title="Rename">✏️</button>
                    <button class="delete-btn" onclick="event.stopPropagation(); App.deleteBoard(${board.id})" title="Delete">✕</button>
                </div>
                <div class="board-card-title">${escHtml(board.name)}</div>
                <div class="board-card-count">${assetCount} items</div>
            </div>
        `;
    }

    function setupBoardDragDrop() {
        const grid = $('#boardGrid');
        if (!grid) return;
        let dragEl = null;

        grid.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.board-card');
            if (!card) return;
            dragEl = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.boardId);
        });

        grid.addEventListener('dragend', (e) => {
            const card = e.target.closest('.board-card');
            if (card) card.classList.remove('dragging');
            $$('.board-card.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        grid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.board-card');
            if (target && target !== dragEl) {
                $$('.board-card.drag-over').forEach(el => el.classList.remove('drag-over'));
                target.classList.add('drag-over');
            }
        });

        grid.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.board-card');
            if (target) target.classList.remove('drag-over');
        });

        grid.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.board-card');
            if (!target || !dragEl || target === dragEl) return;
            $$('.board-card.drag-over').forEach(el => el.classList.remove('drag-over'));
            const parent = grid;
            const siblings = $$('.board-card', parent);
            const fromIdx = siblings.indexOf(dragEl);
            const toIdx = siblings.indexOf(target);
            if (fromIdx < toIdx) parent.insertBefore(dragEl, target.nextSibling);
            else parent.insertBefore(dragEl, target);
            showToast('Board reordered');
        });

        // Touch
        let touchDragEl = null, touchClone = null;
        grid.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.board-card');
            if (!card || e.target.closest('.board-card-actions')) return;
            touchDragEl = card;
            touchClone = card.cloneNode(true);
            touchClone.style.position = 'fixed';
            touchClone.style.width = card.offsetWidth + 'px';
            touchClone.style.zIndex = '999';
            touchClone.style.pointerEvents = 'none';
            touchClone.style.opacity = '0.7';
            touchClone.style.transform = 'scale(0.95)';
            document.body.appendChild(touchClone);
            const touch = e.touches[0];
            touchClone.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
            touchClone.style.top = (touch.clientY - 40) + 'px';
            card.classList.add('dragging');
        }, { passive: true });

        grid.addEventListener('touchmove', (e) => {
            if (!touchClone) return;
            e.preventDefault();
            const touch = e.touches[0];
            touchClone.style.left = (touch.clientX - touchClone.offsetWidth / 2) + 'px';
            touchClone.style.top = (touch.clientY - 40) + 'px';
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target) {
                const card = target.closest('.board-card');
                $$('.board-card.drag-over').forEach(el => el.classList.remove('drag-over'));
                if (card && card !== touchDragEl) card.classList.add('drag-over');
            }
        }, { passive: false });

        grid.addEventListener('touchend', () => {
            if (!touchClone) return;
            document.body.removeChild(touchClone);
            touchClone = null;
            $$('.board-card.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (touchDragEl) touchDragEl.classList.remove('dragging');
            touchDragEl = null;
        }, { passive: true });

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.board-card');
            if (!card || e.target.closest('.board-card-actions')) return;
            navigateToBoard(parseInt(card.dataset.boardId));
        });
    }

    // ─── BOARD VIEW (FREE FORM CANVAS) ───

    async function renderBoardView(boardId) {
        const board = await idb.getBoard(boardId);
        if (!board) { renderDashboard(); return; }

        state.breadcrumb = [];
        let current = board;
        while (current) {
            state.breadcrumb.unshift({ id: current.id, name: current.name });
            if (current.parentId) current = await idb.getBoard(current.parentId);
            else current = null;
        }

        const allBoards = await idb.getAllBoards();
        const subBoards = allBoards.filter(b => b.parentId === boardId);
        const subCounts = {};
        for (const sb of subBoards) {
            const a = await idb.getAssetsByBoard(sb.id);
            subCounts[sb.id] = a.length;
        }

        let assets = await idb.getAssetsByBoard(boardId);

        // Clean up old object URLs
        state.objectURLs.forEach(url => URL.revokeObjectURL(url));
        state.objectURLs = [];
        Object.values(state.fontURLs).forEach(url => URL.revokeObjectURL(url));
        state.fontURLs = {};

        // Check if all assets are colors (for palette toggle)
        const allColors = assets.length > 0 && assets.every(a => a.type === 'color');
        const showPalette = state.paletteView && allColors;

        // Generate object URLs for images + fonts
        const imgURLs = {};
        const fontSpecimenURLs = {};
        const fileOpenURLs = {};
        const fontFaceDeclarations = [];

        for (const a of assets) {
            if (a.type === 'image' && a.data instanceof Blob) {
                const url = URL.createObjectURL(a.data);
                imgURLs[a.id] = url;
                state.objectURLs.push(url);
            }
            if (a.type === 'file' && a.data instanceof Blob) {
                const ext = extFromName(a.name || '');
                if (isFont(a.mime || '', ext)) {
                    const url = URL.createObjectURL(a.data);
                    fontSpecimenURLs[a.id] = url;
                    state.fontURLs[a.id] = url;
                    const family = `hb-font-${a.id}`;
                    fontFaceDeclarations.push(`
                        @font-face {
                            font-family: '${family}';
                            src: url('${url}') format('${a.mime || "truetype"}');
                        }
                    `);
                    a._fontFamily = family;
                } else if (isPDF(a.mime || '', ext)) {
                    const url = URL.createObjectURL(a.data);
                    fileOpenURLs[a.id] = url;
                    state.objectURLs.push(url);
                }
            }
        }

        // Assign default x,y for assets that don't have them (never moves cards with stored positions)
        const hasAnyPosition = assets.some(a => a.x !== undefined && a.y !== undefined);
        const assetsNeedingPos = assets.filter(a => a.x === undefined || a.y === undefined);
        if (assetsNeedingPos.length > 0) {
            const viewW = window.innerWidth - 48; // approximate canvas viewport width
            const gridOptions = {
                image: { w: 200, h: 280 },
                color: { w: 180, h: 110 },
                note: { w: 240, h: 80 },
                link: { w: 240, h: 60 },
                file: { w: 240, h: 90 },
            };
            const GAP = 40;
            let colIdx = 0, rowIdx = 0, maxRowH = 0;
            for (const a of assetsNeedingPos) {
                // Only position assets that are renderable on the canvas
                if (a.type === 'color' || a.type === 'image' || a.type === 'note' || a.type === 'link' || a.type === 'file') {
                    const card = gridOptions[a.type] || { w: 220, h: 100 };
                    const cardW = card.w;
                    const cardH = card.h;
                    const cols = Math.max(1, Math.min(6, Math.floor(viewW / (cardW + GAP))));
                    const col = colIdx % cols;
                    const row = Math.floor(colIdx / cols);
                    a.x = 60 + col * (cardW + GAP);
                    a.y = 40 + row * (cardH + GAP);
                    a._needsSave = true;
                    colIdx++;
                    maxRowH = Math.max(maxRowH, cardH);
                }
            }
        }

        // Save any assets that got default positions
        const savePromises = assets.filter(a => a._needsSave).map(a => {
            delete a._needsSave;
            return idb.putAsset(a);
        });
        await Promise.all(savePromises);

        // Render
        els.main.innerHTML = `
            <style id="fontFaces">${fontFaceDeclarations.join('\n')}</style>
            <div class="board-view">
                <div class="breadcrumb">
                    <a onclick="App.navigateToDashboard()">Dashboard</a>
                    ${state.breadcrumb.slice(0, -1).map(b => `
                        <span>/</span>
                        <a onclick="App.navigateToBoard(${b.id})">${escHtml(b.name)}</a>
                    `).join('')}
                    <span>/</span>
                    <span>${escHtml(board.name)}</span>
                </div>

                <div class="board-view-header">
                    <h2>${escHtml(board.name)}</h2>
                    <div class="board-actions">
                        ${allColors && assets.length > 0 ? `
                            <button class="view-toggle${showPalette ? ' active' : ''}" onclick="App.togglePaletteView(${boardId})">
                                ${showPalette ? 'Grid View' : 'Palette View'}
                            </button>
                        ` : ''}
                        <button class="fit-btn" onclick="App.fitToContent()">Fit</button>
                        <button onclick="App.regridBoard(${boardId})">Re-grid</button>
                        <button onclick="App.showNewBoardModal(${boardId})">+ Sub-Board</button>
                        <button onclick="App.showAddAssetModal(${boardId})">+ Add</button>
                        <button onclick="App.showShareModal(${boardId})">Share</button>
                        <button onclick="App.showEditBoardModal(${boardId})">Rename</button>
                    </div>
                </div>

                ${subBoards.length > 0 ? `
                    <div class="sub-boards-section">
                        <div class="section-label">Sub-Boards</div>
                        <div class="board-grid" id="subBoardGrid">
                            ${subBoards.map(sb => renderBoardCard(sb, subCounts[sb.id] || 0)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${showPalette ? `
                    <div class="board-view-assets">
                        <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:8px;">
                            Assets (${assets.length}) &mdash; <a href="#" onclick="App.togglePaletteView(${boardId});return false" style="color:var(--accent)">Switch to grid view</a>
                        </div>
                        ${renderPaletteStrip(assets)}
                    </div>
                ` : `
                    <div class="canvas-viewport" id="canvasViewport">
                        <div class="canvas-inner" id="canvasInner" style="transform: translate(${state.canvasOffsetX}px, ${state.canvasOffsetY}px)">
                            ${subBoards.length > 0 ? subBoards.map(sb => renderCanvasSubBoardCard(sb, subCounts[sb.id] || 0)).join('') : ''}
                            ${assets.map(a => renderCanvasCard(a, imgURLs[a.id], fontSpecimenURLs[a.id], fileOpenURLs[a.id])).join('')}
                        </div>
                        <div class="minimap-container" id="minimapContainer">
                            <canvas id="minimapCanvas" width="200" height="150"></canvas>
                        </div>
                        <div class="bulk-delete-toolbar" id="bulkDeleteToolbar" style="display:none">
                            <button class="btn-danger" id="bulkDeleteBtn">Delete selected (0)</button>
                        </div>
                    </div>
                `}
            </div>
        `;

        if (subBoards.length > 0) {
            const grid = $('#subBoardGrid');
            if (grid) {
                grid.addEventListener('click', (e) => {
                    const card = e.target.closest('.board-card');
                    if (!card || e.target.closest('.board-card-actions')) return;
                    navigateToBoard(parseInt(card.dataset.boardId));
                });
            }
        }

        if (!showPalette) {
            setupCanvas();
        }

        updateNav();
    }

    // ─── CANVAS CARD RENDERERS ───

    function renderCanvasCard(asset, imageURL, fontURL, fileOpenURL) {
        const id = asset.id;
        const x = asset.x || 0;
        const y = asset.y || 0;
        const actions = `
            <div class="card-actions">
                <button class="delete-btn" onclick="event.stopPropagation(); App.deleteAsset(${id})" title="Delete">✕</button>
            </div>
        `;

        switch (asset.type) {
            case 'color':
                return `
                    <div class="canvas-card card-color" data-asset-id="${id}" style="left:${x}px;top:${y}px">
                        ${actions}
                        <div class="color-swatch" style="background:${asset.hex || '#ccc'}"></div>
                        <div class="color-info">
                            <div class="hex">${escHtml(asset.hex || '')}</div>
                            ${asset.pantone ? `<div class="pantone">PN: ${escHtml(asset.pantone)}</div>` : ''}
                        </div>
                    </div>`;
            case 'image':
                return `
                    <div class="canvas-card card-image" data-asset-id="${id}" style="left:${x}px;top:${y}px">
                        ${actions}
                        <img src="${imageURL || ''}" alt="${escHtml(asset.alt || '')}" loading="lazy" draggable="false">
                        <div class="img-label">${escHtml(asset.alt || 'untitled')}</div>
                    </div>`;
            case 'link':
                return `
                    <div class="canvas-card card-link" data-asset-id="${id}" style="left:${x}px;top:${y}px">
                        ${actions}
                        <a href="${escHtml(asset.url)}" target="_blank" rel="noopener">${escHtml(asset.title || asset.url)}</a>
                        <div class="link-url">${escHtml(asset.url)}</div>
                    </div>`;
            case 'note':
                return `
                    <div class="canvas-card card-note" data-asset-id="${id}" style="left:${x}px;top:${y}px">
                        ${actions}
                        <div class="note-content">${escHtml(asset.content || '')}</div>
                    </div>`;
            case 'file': {
                const ext = extFromName(asset.name || '');
                const isFontFile = isFont(asset.mime || '', ext);
                const isPDFFile = isPDF(asset.mime || '', ext);
                let typeIcon = '📄', iconClass = 'generic';
                if (isPDFFile) { typeIcon = '📕'; iconClass = 'pdf'; }
                if (isFontFile) { typeIcon = '🔤'; iconClass = 'font'; }

                return `
                    <div class="canvas-card card-file" data-asset-id="${id}" style="left:${x}px;top:${y}px">
                        ${actions}
                        <div class="file-icon-row" onclick="App.openFile(${id})" style="cursor:pointer">
                            <div class="file-type-icon ${iconClass}">${typeIcon}</div>
                            <div class="file-meta">
                                <div class="file-name">${escHtml(asset.name || 'file')}</div>
                                <div class="file-size">${formatSize(asset.size || 0)}${isFontFile ? ' · Font' : isPDFFile ? ' · PDF' : ''}</div>
                            </div>
                        </div>
                        ${isFontFile && fontURL ? `
                            <div class="font-specimen" style="font-family:'hb-font-${id}'">Aa</div>
                        ` : ''}
                    </div>`;
            }
            default:
                return '';
        }
    }

    function renderCanvasSubBoardCard(board, assetCount) {
        const x = board._canvasX || 60;
        const y = board._canvasY || 40;
        return `
            <div class="canvas-card card-sub-board" data-board-id="${board.id}" style="left:${x}px;top:${y}px" onclick="App.navigateToBoard(${board.id})">
                <div class="sub-board-title">${escHtml(board.name)}</div>
                <div class="sub-board-count">${assetCount} items</div>
            </div>
        `;
    }

    // ─── PALETTE VIEW ───

    function renderPaletteStrip(assets) {
        const colors = assets.filter(a => a.type === 'color');
        return `
            <div class="palette-strip">
                ${colors.map(c => `
                    <div class="palette-item">
                        <div class="palette-swatch" style="background:${c.hex}"></div>
                        <div class="palette-info">
                            <div class="hex">${c.hex}</div>
                            ${c.pantone ? `<div class="pantone">${escHtml(c.pantone)}</div>` : ''}
                        </div>
                        <div class="card-actions" style="position:relative;opacity:1;margin-top:4px">
                            <button class="delete-btn" onclick="App.deleteAsset(${c.id})" title="Delete">✕</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function togglePaletteView(boardId) {
        state.paletteView = !state.paletteView;
        renderBoardView(boardId);
    }

    // ─── CANVAS INTERACTION ───

    function clearSelection() {
        $$('.canvas-card.selected').forEach(el => el.classList.remove('selected'));
        state._selectedCards = [];
        const toolbar = $('#bulkDeleteToolbar');
        if (toolbar) {
            toolbar.innerHTML = '<button class="btn-danger" id="bulkDeleteBtn">Delete selected (0)</button>';
            toolbar.style.display = 'none';
        }
    }

    function updateBulkDeleteToolbar() {
        const cards = state._selectedCards || [];
        const toolbar = $('#bulkDeleteToolbar');
        if (!toolbar) return;
        if (cards.length === 0) {
            toolbar.innerHTML = '<button class="btn-danger" id="bulkDeleteBtn">Delete selected (0)</button>';
            toolbar.style.display = 'none';
            return;
        }
        toolbar.innerHTML = `<button class="btn-danger" id="bulkDeleteBtn">Delete selected (${cards.length})</button>`;
        toolbar.style.display = 'flex';
        const btn = $('#bulkDeleteBtn');
        if (btn) btn.onclick = deleteSelectedAssets;
    }

    function getCardRect(card) {
        const left = parseFloat(card.style.left) || 0;
        const top = parseFloat(card.style.top) || 0;
        const w = card.offsetWidth || 100;
        const h = card.offsetHeight || 80;
        return { left, top, right: left + w, bottom: top + h, w, h };
    }

    function rectsIntersect(r1, r2) {
        return !(r1.right <= r2.left || r1.left >= r2.right || r1.bottom <= r2.top || r1.top >= r2.bottom);
    }

    function setupCanvas() {
        const viewport = $('#canvasViewport');
        const inner = $('#canvasInner');
        if (!viewport || !inner) return;

        // Track which interaction mode we're in
        let interactionMode = null; // 'pan' | 'rubberBand' | 'cardDrag' | 'groupDrag'

        // ── Clear selection helper (skip when shift is held for rubber-band) ──
        function onClearSelection(e) {
            if (e && (e.target.closest('.canvas-card') || e.target.closest('.card-actions') || e.shiftKey)) return;
            clearSelection();
        }

        // ── Select via shift+click ──
        function onShiftClickCard(card) {
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) {
                state._selectedCards = state._selectedCards || [];
                state._selectedCards.push(card);
            } else {
                state._selectedCards = (state._selectedCards || []).filter(c => c !== card);
            }
            updateBulkDeleteToolbar();
        }

        // ── Mousedown handler ──
        function onMouseDown(e) {
            const target = e.target;
            const card = target.closest('.canvas-card');
            const isCardAction = target.closest('.card-actions');
            const isShift = e.shiftKey;

            if (card && !isCardAction) {
                e.stopPropagation();
                // Track mousedown position for click vs drag detection
                state._mouseDownX = e.clientX;
                state._mouseDownY = e.clientY;
                state._mouseDownOnImage = card.classList.contains('card-image');
                if (isShift) {
                    // Shift+click: toggle selection
                    onShiftClickCard(card);
                    return;
                }
                // Regular click on card: if not selected and we have other selections, deselect all first
                if (!card.classList.contains('selected')) {
                    clearSelection();
                }
                // If this card is selected and there are multiple selected, start group drag
                if (card.classList.contains('selected') && (state._selectedCards || []).length > 1) {
                    interactionMode = 'groupDrag';
                    state.draggingCardEl = card;
                    state.dragStartMouseX = e.clientX;
                    state.dragStartMouseY = e.clientY;
                    // Record initial positions of all selected cards
                    state._groupDragOrigins = (state._selectedCards || []).map(c => ({
                        el: c,
                        startX: parseFloat(c.style.left) || 0,
                        startY: parseFloat(c.style.top) || 0,
                    }));
                    card.classList.add('dragging');
                    (state._selectedCards || []).forEach(c => {
                        if (c !== card) c.style.opacity = '0.7';
                    });
                    return;
                }
                // Single card drag
                if (!card.classList.contains('selected')) {
                    clearSelection();
                }
                interactionMode = 'cardDrag';
                state.draggingCardEl = card;
                state.dragAssetId = parseInt(card.dataset.assetId);
                state.dragStartMouseX = e.clientX;
                state.dragStartMouseY = e.clientY;
                state.dragStartCardX = parseFloat(card.style.left) || 0;
                state.dragStartCardY = parseFloat(card.style.top) || 0;
                card.classList.add('dragging');
                return;
            }

            // Click on empty canvas
            if (!isShift) {
                clearSelection();
            }

            // Shift+drag on empty canvas = rubber band (in canvas coordinates)
            if (isShift) {
                interactionMode = 'rubberBand';
                const rect = viewport.getBoundingClientRect();
                const vpX = e.clientX - rect.left + viewport.scrollLeft;
                const vpY = e.clientY - rect.top + viewport.scrollTop;
                state._rubberStartX = vpX - state.canvasOffsetX;
                state._rubberStartY = vpY - state.canvasOffsetY;
                state._rubberEl = document.createElement('div');
                state._rubberEl.className = 'rubber-band';
                state._rubberEl.style.left = state._rubberStartX + 'px';
                state._rubberEl.style.top = state._rubberStartY + 'px';
                state._rubberEl.style.width = '0px';
                state._rubberEl.style.height = '0px';
                inner.appendChild(state._rubberEl);
                return;
            }

            // Plain drag on empty canvas = pan
            interactionMode = 'pan';
            state.isPanning = true;
            viewport.classList.add('panning');
            state.panStartX = e.clientX;
            state.panStartY = e.clientY;
            state.panStartOffX = state.canvasOffsetX;
            state.panStartOffY = state.canvasOffsetY;
        }

        // ── Mousemove handler ──
        function onMouseMove(e) {
            if (interactionMode === 'pan' && state.isPanning) {
                const dx = e.clientX - state.panStartX;
                const dy = e.clientY - state.panStartY;
                state.canvasOffsetX = state.panStartOffX + dx;
                state.canvasOffsetY = state.panStartOffY + dy;
                inner.style.transform = `translate(${state.canvasOffsetX}px, ${state.canvasOffsetY}px)`;
                redrawMinimapViewport();
                return;
            }

            if (interactionMode === 'rubberBand' && state._rubberEl) {
                const rect = viewport.getBoundingClientRect();
                const vpX = e.clientX - rect.left + viewport.scrollLeft;
                const vpY = e.clientY - rect.top + viewport.scrollTop;
                const mx = vpX - state.canvasOffsetX;
                const my = vpY - state.canvasOffsetY;
                const sx = state._rubberStartX;
                const sy = state._rubberStartY;
                const left = Math.min(sx, mx);
                const top = Math.min(sy, my);
                const w = Math.abs(mx - sx);
                const h = Math.abs(my - sy);
                state._rubberEl.style.left = left + 'px';
                state._rubberEl.style.top = top + 'px';
                state._rubberEl.style.width = w + 'px';
                state._rubberEl.style.height = h + 'px';
                return;
            }

            if (interactionMode === 'cardDrag' && state.draggingCardEl) {
                e.preventDefault();
                const dx = e.clientX - state.dragStartMouseX;
                const dy = e.clientY - state.dragStartMouseY;
                const newX = Math.max(0, Math.round(state.dragStartCardX + dx));
                const newY = Math.max(0, Math.round(state.dragStartCardY + dy));
                state.draggingCardEl.style.left = newX + 'px';
                state.draggingCardEl.style.top = newY + 'px';
                state._dragNewX = newX;
                state._dragNewY = newY;
                return;
            }

            if (interactionMode === 'groupDrag' && state.draggingCardEl && state._groupDragOrigins) {
                e.preventDefault();
                const dx = e.clientX - state.dragStartMouseX;
                const dy = e.clientY - state.dragStartMouseY;
                state._groupDragOrigins.forEach(({ el, startX, startY }) => {
                    const nx = Math.max(0, Math.round(startX + dx));
                    const ny = Math.max(0, Math.round(startY + dy));
                    el.style.left = nx + 'px';
                    el.style.top = ny + 'px';
                });
                // Store offsets for save on drop
                state._groupDragDx = dx;
                state._groupDragDy = dy;
            }
        }

        // ── Mouseup handler ──
        async function onMouseUp(e) {
            // Rubber-band finish: select intersecting cards
            if (interactionMode === 'rubberBand' && state._rubberEl) {
                const rb = state._rubberEl;
                const rbRect = {
                    left: parseFloat(rb.style.left),
                    top: parseFloat(rb.style.top),
                    right: parseFloat(rb.style.left) + parseFloat(rb.style.width),
                    bottom: parseFloat(rb.style.top) + parseFloat(rb.style.height),
                };
                inner.removeChild(rb);
                state._rubberEl = null;

                const allCards = $$('.canvas-card', inner);
                state._selectedCards = [];
                for (const card of allCards) {
                    const cardRect = getCardRect(card);
                    if (rectsIntersect(rbRect, cardRect)) {
                        card.classList.add('selected');
                        state._selectedCards.push(card);
                    } else {
                        card.classList.remove('selected');
                    }
                }
                updateBulkDeleteToolbar();
                interactionMode = null;
                return;
            }

            // Single card drag finish
            if (interactionMode === 'cardDrag' && state.draggingCardEl) {
                state.draggingCardEl.classList.remove('dragging');
                const assetId = state.dragAssetId;
                const newX = state._dragNewX;
                const newY = state._dragNewY;

                state.draggingCardEl = null;
                state.dragAssetId = null;
                state._dragNewX = null;
                state._dragNewY = null;
                interactionMode = null;

                if (newX !== undefined && newY !== undefined && assetId) {
                    const asset = await getAssetById(assetId);
                    if (asset) {
                        asset.x = newX;
                        asset.y = newY;
                        await idb.putAsset(asset);
                    }
                }
                return;
            }

            // Group drag finish
            if (interactionMode === 'groupDrag' && state.draggingCardEl && state._groupDragOrigins) {
                state.draggingCardEl.classList.remove('dragging');
                (state._selectedCards || []).forEach(c => c.style.opacity = '');
                const dx = state._groupDragDx || 0;
                const dy = state._groupDragDy || 0;

                // Save all moved cards
                for (const { el, startX, startY } of state._groupDragOrigins) {
                    const newX = Math.max(0, Math.round(startX + dx));
                    const newY = Math.max(0, Math.round(startY + dy));
                    const assetId = parseInt(el.dataset.assetId);
                    if (assetId) {
                        const asset = await getAssetById(assetId);
                        if (asset) {
                            asset.x = newX;
                            asset.y = newY;
                            await idb.putAsset(asset);
                        }
                    }
                }

                state.draggingCardEl = null;
                state._groupDragOrigins = null;
                state._groupDragDx = null;
                state._groupDragDy = null;
                interactionMode = null;
                renderMinimapLater();
                return;
            }

            // Pan finish
            if (interactionMode === 'pan') {
                state.isPanning = false;
                viewport.classList.remove('panning');
                interactionMode = null;
                renderMinimapLater();
                return;
            }

            // Stationary click on image card → open lightbox (if not shift, not a drag)
            const mdx = Math.abs((e.clientX || 0) - (state._mouseDownX || 0));
            const mdy = Math.abs((e.clientY || 0) - (state._mouseDownY || 0));
            if (interactionMode === null && state._mouseDownOnImage && !e.shiftKey && mdx < 5 && mdy < 5) {
                const card = (e.target || e.srcElement).closest('.canvas-card');
                if (card && card.classList.contains('card-image')) {
                    const assetId = parseInt(card.dataset.assetId);
                    if (assetId) openLightbox(assetId);
                }
            }
            state._mouseDownOnImage = false;
            state._mouseDownX = null;
            state._mouseDownY = null;
            interactionMode = null;
        }

        // ── Double-click to edit label ──
        function onCanvasDblClick(e) {
            const target = e.target;
            // Check if double-click on a label field for inline rename
            const labelEl = target.closest('.img-label, .note-content, .file-name, .card-color .hex, .card-link a');
            if (labelEl) {
                e.preventDefault();
                e.stopPropagation();
                const card = labelEl.closest('.canvas-card');
                if (!card) return;
                const assetId = parseInt(card.dataset.assetId);
                if (!assetId) return;
                const field = labelEl.classList.contains('img-label') ? 'alt'
                    : labelEl.classList.contains('note-content') ? 'content'
                    : labelEl.classList.contains('file-name') ? 'name'
                    : labelEl.classList.contains('hex') ? 'hex'
                    : labelEl.closest('.card-link') ? 'title'
                    : null;
                if (!field) return;

                const currentVal = labelEl.textContent.trim();
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'label-edit-input';
                input.value = currentVal;
                input.dataset.assetId = assetId;
                input.dataset.field = field;
                input.dataset.origVal = currentVal;

                labelEl.textContent = '';
                labelEl.appendChild(input);
                input.focus();
                input.select();

                function finishEdit(save) {
                    const newVal = input.value.trim();
                    if (save && newVal && newVal !== input.dataset.origVal) {
                        saveAssetLabel(assetId, field, newVal);
                        input.dataset.origVal = newVal;
                    }
                    const display = save && newVal !== '' ? newVal : input.dataset.origVal;
                    labelEl.textContent = display;
                }

                input.addEventListener('blur', () => finishEdit(true));
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                    if (ev.key === 'Escape') { ev.preventDefault(); finishEdit(false); }
                });
                return;
            }

            if (target.closest('.canvas-card') || target.closest('.card-actions')) return;
            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + viewport.scrollLeft;
            const mouseY = e.clientY - rect.top + viewport.scrollTop;
            // Convert to canvas coordinates
            const canvasX = Math.round(mouseX - state.canvasOffsetX);
            const canvasY = Math.round(mouseY - state.canvasOffsetY);
            state.newAssetX = Math.max(20, Math.min(canvasX, CANVAS_W - 100));
            state.newAssetY = Math.max(20, Math.min(canvasY, CANVAS_H - 100));
            showAddAssetModal(state.currentBoardId);
        }

        // ── Escape key clears selection ──
        function onKeyDown(e) {
            if (e.key === 'Escape') {
                clearSelection();
            }
        }

        // ── Attach events ──
        viewport.addEventListener('mousedown', onMouseDown);
        // Only onMouseMove/MouseUp on window for robust tracking
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        viewport.addEventListener('dblclick', onCanvasDblClick);
        window.addEventListener('keydown', onKeyDown);
        viewport.addEventListener('mousedown', onClearSelection);

        // Initial minimap render
        redrawMinimapContent();
        setupMinimapInteraction();

        // Viewport scroll events update minimap viewport indicator in real time
        function onScroll() { redrawMinimapViewport(); }
        viewport.addEventListener('scroll', onScroll);

        // ── Drag-and-drop file import ──
        const dropOverlay = document.createElement('div');
        dropOverlay.className = 'canvas-drop-overlay';
        dropOverlay.innerHTML = '<span>Drop files to add to board</span>';
        dropOverlay.style.display = 'none';
        viewport.appendChild(dropOverlay);

        let dropCounter = 0;

        viewport.addEventListener('dragenter', (e) => {
            if (state.view !== 'board' || !state.currentBoardId) return;
            if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
            e.preventDefault();
            dropCounter++;
            dropOverlay.style.display = 'flex';
        });

        viewport.addEventListener('dragover', (e) => {
            if (state.view !== 'board' || !state.currentBoardId) return;
            if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
            e.preventDefault();
        });

        viewport.addEventListener('dragleave', (e) => {
            if (state.view !== 'board' || !state.currentBoardId) return;
            dropCounter--;
            if (dropCounter <= 0) {
                dropCounter = 0;
                dropOverlay.style.display = 'none';
            }
        });

        viewport.addEventListener('drop', (e) => {
            if (state.view !== 'board' || !state.currentBoardId) return;
            e.preventDefault();
            dropCounter = 0;
            dropOverlay.style.display = 'none';

            const files = [...(e.dataTransfer.files || [])];
            if (files.length === 0) return;

            // Calculate drop position in canvas coordinates
            const rect = viewport.getBoundingClientRect();
            const vpX = e.clientX - rect.left + viewport.scrollLeft;
            const vpY = e.clientY - rect.top + viewport.scrollTop;
            const canvasX = Math.round(vpX - state.canvasOffsetX);
            const canvasY = Math.round(vpY - state.canvasOffsetY);

            handleCanvasDrop(state.currentBoardId, files, Math.max(20, canvasX), Math.max(20, canvasY));
        });

        // Cleanup
        state._cleanupCanvas = () => {
            viewport.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            viewport.removeEventListener('dblclick', onCanvasDblClick);
            window.removeEventListener('keydown', onKeyDown);
            viewport.removeEventListener('mousedown', onClearSelection);
            if (dropOverlay.parentNode) dropOverlay.parentNode.removeChild(dropOverlay);
        };
    }

    // ─── MINIMAP ───

    let _minimapTimer = null;
    let _minimapSnapshot = null;       // cached ImageData of card layer

    function renderMinimapLater() {
        if (_minimapTimer) clearTimeout(_minimapTimer);
        _minimapTimer = setTimeout(() => { _minimapTimer = null; redrawMinimapContent(); }, 150);
    }

    function redrawMinimapContent() {
        const canvas = $('#minimapCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = 200, h = 150;
        const scaleX = w / CANVAS_W;
        const scaleY = h / CANVAS_H;

        ctx.clearRect(0, 0, w, h);

        const cards = $$('.canvas-card', $('#canvasInner'));
        for (const card of cards) {
            const left = parseFloat(card.style.left) || 0;
            const top = parseFloat(card.style.top) || 0;
            const cw = card.offsetWidth || 100;
            const ch = card.offsetHeight || 80;
            const rx = left * scaleX;
            const ry = top * scaleY;
            const rw = Math.max(2, cw * scaleX);
            const rh = Math.max(2, ch * scaleY);

            if (card.classList.contains('card-color')) {
                const swatch = card.querySelector('.color-swatch');
                if (swatch) {
                    const bg = swatch.style.background || '#666';
                    ctx.fillStyle = bg;
                } else {
                    ctx.fillStyle = '#666';
                }
            } else if (card.classList.contains('card-image')) {
                ctx.fillStyle = 'rgba(200, 168, 78, 0.6)';
            } else {
                ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
            }
            ctx.fillRect(rx, ry, rw, rh);
        }

        // Cache card-layer snapshot
        _minimapSnapshot = ctx.getImageData(0, 0, w, h);

        // Draw viewport indicator on top
        drawMinimapViewport(ctx, w, h, scaleX, scaleY);
    }

    function drawMinimapViewport(ctx, w, h, scaleX, scaleY) {
        const viewport = $('#canvasViewport');
        if (!viewport) return;
        const vpW = viewport.clientWidth;
        const vpH = viewport.clientHeight;
        const vpx = Math.max(0, (-state.canvasOffsetX) * scaleX);
        const vpy = Math.max(0, (-state.canvasOffsetY) * scaleY);
        const vprw = Math.min(w - vpx, vpW * scaleX);
        const vprh = Math.min(h - vpy, vpH * scaleY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vpx, vpy, vprw, vprh);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(vpx, vpy, vprw, vprh);
    }

    function redrawMinimapViewport() {
        const canvas = $('#minimapCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = 200, h = 150;
        const scaleX = w / CANVAS_W;
        const scaleY = h / CANVAS_H;

        // Restore cached card snapshot
        if (_minimapSnapshot) {
            ctx.putImageData(_minimapSnapshot, 0, 0);
        } else {
            redrawMinimapContent();
            return;
        }

        // Draw viewport indicator on top
        drawMinimapViewport(ctx, w, h, scaleX, scaleY);
    }

    function setupMinimapInteraction() {
        const container = $('#minimapContainer');
        const canvas = $('#minimapCanvas');
        if (!container || !canvas) return;

        let isDragging = false;

        function minimapPanTo(e) {
            const rect = container.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / rect.width;
            const my = (e.clientY - rect.top) / rect.height;
            const viewport = $('#canvasViewport');
            const inner = $('#canvasInner');
            if (!viewport || !inner) return;
            const targetX = Math.round(viewport.clientWidth / 2 - mx * CANVAS_W);
            const targetY = Math.round(viewport.clientHeight / 2 - my * CANVAS_H);
            state.canvasOffsetX = Math.min(0, Math.max(-(CANVAS_W - viewport.clientWidth), targetX));
            state.canvasOffsetY = Math.min(0, Math.max(-(CANVAS_H - viewport.clientHeight), targetY));
            inner.style.transform = `translate(${state.canvasOffsetX}px, ${state.canvasOffsetY}px)`;
            // During drag, only redraw viewport indicator for zero-lag response
            if (isDragging) {
                redrawMinimapViewport();
            } else {
                renderMinimapLater();
            }
        }

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            minimapPanTo(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            minimapPanTo(e);
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                renderMinimapLater();
            }
        });

        // Store cleanup
        const prevCleanup = state._cleanupCanvas;
        state._cleanupCanvas = () => {
            if (prevCleanup) prevCleanup();
            // Cleanup minimap events (they're on window/container so will persist)
        };
    }

    // ─── FIT TO CONTENT ───

    async function fitToContent() {
        const inner = $('#canvasInner');
        const viewport = $('#canvasViewport');
        if (!inner || !viewport) return;

        const cards = $$('.canvas-card', inner);
        if (cards.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const card of cards) {
            const left = parseFloat(card.style.left) || 0;
            const top = parseFloat(card.style.top) || 0;
            const w = card.offsetWidth || 100;
            const h = card.offsetHeight || 80;
            if (left < minX) minX = left;
            if (top < minY) minY = top;
            if (left + w > maxX) maxX = left + w;
            if (top + h > maxY) maxY = top + h;
        }

        const viewW = viewport.clientWidth;
        const viewH = viewport.clientHeight;
        const contentW = maxX - minX + 120;
        const contentH = maxY - minY + 120;
        const cx = minX + (maxX - minX) / 2;
        const cy = minY + (maxY - minY) / 2;

        state.canvasOffsetX = Math.round(viewW / 2 - cx);
        state.canvasOffsetY = Math.round(viewH / 2 - cy);
        inner.style.transform = `translate(${state.canvasOffsetX}px, ${state.canvasOffsetY}px)`;
        showToast('Fitted to content');
    }

    // ─── RE-GRID ───

    async function regridBoard(boardId) {
        const assets = await idb.getAssetsByBoard(boardId);
        const rows = assets.filter(a => a.type === 'color' || a.type === 'image' || a.type === 'note' || a.type === 'link' || a.type === 'file');
        if (rows.length === 0) { showToast('No grid items to re-grid'); return; }

        const viewW = window.innerWidth - 48;
        const gridOptions = {
            image: { w: 200, h: 280 },
            color: { w: 180, h: 110 },
            note: { w: 240, h: 80 },
            link: { w: 240, h: 60 },
            file: { w: 240, h: 90 },
        };
        const GAP = 40;
        let colIdx = 0;

        for (const a of rows) {
            const card = gridOptions[a.type] || { w: 220, h: 100 };
            const cardW = card.w;
            const cardH = card.h;
            const cols = Math.max(1, Math.min(6, Math.floor(viewW / (cardW + GAP))));
            const col = colIdx % cols;
            const row = Math.floor(colIdx / cols);
            a.x = 60 + col * (cardW + GAP);
            a.y = 40 + row * (cardH + GAP);
            await idb.putAsset(a);
            colIdx++;
        }

        showToast('Board re-gridded');
        setTimeout(() => fitToContent(), 50);
        renderBoardView(boardId);
    }

    // ─── FILE OPENING ───

    async function openFile(assetId) {
        const d = await idb.open();
        const tx = d.transaction('assets', 'readonly');
        const store = tx.objectStore('assets');
        return new Promise((resolve, reject) => {
            const req = store.get(assetId);
            req.onsuccess = () => {
                const asset = req.result;
                if (!asset || !(asset.data instanceof Blob)) return;
                const url = URL.createObjectURL(asset.data);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 60000);
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }

    // ─── BOARD CRUD ───

    function showNewBoardModal(parentId) {
        openModal(`
            <h3>New ${parentId ? 'Sub-Board' : 'Board'}</h3>
            <label>Board Name</label>
            <input type="text" id="newBoardName" placeholder="e.g. Album Art, Press Photos" autofocus>
            <div class="modal-actions">
                <button onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.createBoard('${parentId || ''}')">Create</button>
            </div>
        `);
        setTimeout(() => $('#newBoardName').focus(), 100);
    }

    async function createBoard(parentIdStr) {
        const name = $('#newBoardName').value.trim();
        if (!name) return showToast('Board name is required');
        const board = { name, parentId: parentIdStr ? parseInt(parentIdStr) : null, createdAt: new Date(), updatedAt: new Date() };
        await idb.putBoard(board);
        closeModal();
        showToast(`Board "${name}" created`);
        if (parentIdStr) renderBoardView(parseInt(parentIdStr));
        else renderDashboard();
    }

    async function showEditBoardModal(boardId) {
        const board = await idb.getBoard(boardId);
        if (!board) return;
        openModal(`
            <h3>Rename Board</h3>
            <label>Board Name</label>
            <input type="text" id="editBoardName" value="${escHtml(board.name)}" autofocus>
            <div class="modal-actions">
                <button onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.renameBoard(${boardId})">Save</button>
            </div>
        `);
        setTimeout(() => $('#editBoardName').focus(), 100);
    }

    async function renameBoard(boardId) {
        const name = $('#editBoardName').value.trim();
        if (!name) return showToast('Board name is required');
        const board = await idb.getBoard(boardId);
        if (!board) return;
        board.name = name;
        board.updatedAt = new Date();
        await idb.putBoard(board);
        closeModal();
        showToast(`Board renamed to "${name}"`);
        if (state.view === 'board' && state.currentBoardId === boardId) renderBoardView(boardId);
        else renderDashboard();
    }

    async function deleteBoard(boardId) {
        if (!confirm('Delete this board and all its contents?')) return;
        const board = await idb.getBoard(boardId);
        const allBoards = await idb.getAllBoards();
        for (const sb of allBoards.filter(b => b.parentId === boardId)) {
            await idb.deleteAssetsByBoard(sb.id);
            await idb.deleteBoard(sb.id);
        }
        await idb.deleteAssetsByBoard(boardId);
        await idb.deleteBoard(boardId);
        showToast('Board deleted');
        if (state.view === 'board' && state.currentBoardId === boardId) {
            if (board && board.parentId) navigateToBoard(board.parentId);
            else navigateToDashboard();
        } else renderDashboard();
    }

    // ─── ASSET CRUD ───

    function showAddAssetModal(boardId) {
        const defaultX = state.newAssetX;
        const defaultY = state.newAssetY;
        openModal(`
            <h3>Add Asset</h3>
            <label>Type</label>
            <select id="assetType" onchange="App.onAssetTypeChange()">
                <option value="color">Color Swatch</option>
                <option value="image">Image</option>
                <option value="file">File (Font/PDF)</option>
                <option value="link">Link</option>
                <option value="note">Note</option>
            </select>
            <div id="assetFormFields">
                <label>Hex Color</label>
                <input type="text" id="assetHex" placeholder="#c8a84e" value="#">
                <label>Pantone (optional)</label>
                <input type="text" id="assetPantone" placeholder="e.g. 15-0743">
            </div>
            <div class="modal-actions">
                <button onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.createAsset(${boardId}, ${defaultX !== null ? defaultX : 'null'}, ${defaultY !== null ? defaultY : 'null'})">Add</button>
            </div>
        `);
        state.newAssetX = null;
        state.newAssetY = null;
    }

    function onAssetTypeChange() {
        const type = $('#assetType').value;
        const fields = $('#assetFormFields');
        switch (type) {
            case 'color':
                fields.innerHTML = `
                    <label>Hex Color</label>
                    <input type="text" id="assetHex" placeholder="#c8a84e" value="#">
                    <label>Pantone (optional)</label>
                    <input type="text" id="assetPantone" placeholder="e.g. 15-0743">
                `;
                break;
            case 'image':
                fields.innerHTML = `
                    <label>Choose Files</label>
                    <input type="file" id="assetImageFile" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" multiple>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Select individual image files (JPG, PNG, GIF, WebP, SVG).</div>
                    <label>Upload Folder</label>
                    <input type="file" id="assetImageFolder" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" webkitdirectory>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Select a folder to import all images inside it.</div>
                    <label>Label (applies to single file)</label>
                    <input type="text" id="assetImageAlt" placeholder="e.g. Press photo 2026">
                `;
                break;
            case 'file':
                fields.innerHTML = `
                    <label>File(s) &mdash; fonts or PDFs</label>
                    <input type="file" id="assetFileInput" accept=".otf,.ttf,.woff,.pdf,font/otf,font/ttf,font/woff,application/pdf" multiple>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Supports OTF, TTF, WOFF (fonts) and PDF (documents).</div>
                `;
                break;
            case 'link':
                fields.innerHTML = `
                    <label>URL</label>
                    <input type="url" id="assetUrl" placeholder="https://...">
                    <label>Title (optional)</label>
                    <input type="text" id="assetLinkTitle" placeholder="e.g. My Portfolio">
                `;
                break;
            case 'note':
                fields.innerHTML = `
                    <label>Content</label>
                    <textarea id="assetNote" placeholder="Write your note..."></textarea>
                `;
                break;
        }
    }

    function createAsset(boardId, posX, posY) {
        const type = $('#assetType').value;
        // Store position for this creation
        state._pendingX = posX;
        state._pendingY = posY;
        if (type === 'image') {
            createImagesBatch(boardId);
            return;
        }
        if (type === 'file') {
            createFilesBatch(boardId);
            return;
        }
        createSingleAsset(boardId, type);
    }

    // ─── BATCH IMAGE UPLOAD ───

    async function createImagesBatch(boardId) {
        const fileInput = $('#assetImageFile');
        const folderInput = $('#assetImageFolder');
        let files = [];
        if (fileInput.files && fileInput.files.length) {
            files = [...fileInput.files].filter(f => isImage(f.type, extFromName(f.name)));
        }
        if (folderInput.files && folderInput.files.length) {
            files = files.concat([...folderInput.files].filter(f => isImage(f.type, extFromName(f.name))));
        }
        if (files.length === 0) return showToast('No supported image files found');

        showUploadProgress(0, files.length);

        const assets = await idb.getAssetsByBoard(boardId);
        let lastPos = assets.length > 0 ? Math.max(...assets.map(a => a.position)) : 0;

        // Default starting position for batch
        let startX = state._pendingX !== null && state._pendingX !== undefined ? state._pendingX : 100;
        let startY = state._pendingY !== null && state._pendingY !== undefined ? state._pendingY : 100;

        const GW = 200, GH = 280, GAP = 40;
        const imgCols = Math.max(1, Math.min(6, Math.floor((window.innerWidth - 48) / (GW + GAP))));
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            lastPos += 1.0;
            const asset = {
                boardId,
                type: 'image',
                position: lastPos,
                createdAt: new Date(),
                data: file,
                alt: baseName,
                x: startX + (i % imgCols) * (GW + GAP),
                y: startY + Math.floor(i / imgCols) * (GH + GAP),
            };
            await idb.putAsset(asset);
            showUploadProgress(i + 1, files.length);
        }

        fileInput.value = '';
        folderInput.value = '';

        hideUploadProgress();
        closeModal();
        state._pendingX = null;
        state._pendingY = null;
        showToast(`Added ${files.length} image${files.length > 1 ? 's' : ''}`);
        renderBoardView(boardId);
    }

    // ─── BATCH FILE UPLOAD ───

    async function createFilesBatch(boardId) {
        const fileInput = $('#assetFileInput');
        if (!fileInput.files || !fileInput.files.length) return showToast('Please select at least one file');
        const files = [...fileInput.files];
        if (files.length === 0) return showToast('No files selected');

        showUploadProgress(0, files.length);

        const assets = await idb.getAssetsByBoard(boardId);
        let lastPos = assets.length > 0 ? Math.max(...assets.map(a => a.position)) : 0;

        let startX = state._pendingX !== null && state._pendingX !== undefined ? state._pendingX : 100;
        let startY = state._pendingY !== null && state._pendingY !== undefined ? state._pendingY : 100;

        const FW = 240, FH = 90, GAP = 40;
        const fileCols = Math.max(1, Math.min(6, Math.floor((window.innerWidth - 48) / (FW + GAP))));
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            lastPos += 1.0;
            const asset = {
                boardId,
                type: 'file',
                position: lastPos,
                createdAt: new Date(),
                data: file,
                name: file.name,
                size: file.size,
                mime: file.type || 'application/octet-stream',
                x: startX + (i % fileCols) * (FW + GAP),
                y: startY + Math.floor(i / fileCols) * (FH + GAP),
            };
            await idb.putAsset(asset);
            showUploadProgress(i + 1, files.length);
        }

        hideUploadProgress();
        closeModal();
        state._pendingX = null;
        state._pendingY = null;
        showToast(`Added ${files.length} file${files.length > 1 ? 's' : ''}`);
        renderBoardView(boardId);
    }

    // ─── CANVAS DROP HANDLER ───

    async function handleCanvasDrop(boardId, files, dropX, dropY) {
        const images = [];
        const fileAssets = [];

        for (const file of files) {
            const ext = extFromName(file.name);
            if (isImage(file.type, ext)) {
                images.push(file);
            } else if (isFont(file.type, ext) || isPDF(file.type, ext)) {
                fileAssets.push(file);
            }
        }

        const assetsList = await idb.getAssetsByBoard(boardId);
        let lastPos = assetsList.length > 0 ? Math.max(...assetsList.map(a => a.position)) : 0;
        const GAP = 40;

        if (images.length > 0) {
            const GW = 200, GH = 280;
            const imgCols = Math.max(1, Math.min(6, Math.floor((window.innerWidth - 48) / (GW + GAP))));
            showUploadProgress(0, images.length);
            for (let i = 0; i < images.length; i++) {
                const file = images[i];
                const baseName = file.name.replace(/\.[^/.]+$/, '');
                lastPos += 1.0;
                const asset = {
                    boardId,
                    type: 'image',
                    position: lastPos,
                    createdAt: new Date(),
                    data: file,
                    alt: baseName,
                    x: dropX + (i % imgCols) * (GW + GAP),
                    y: dropY + Math.floor(i / imgCols) * (GH + GAP),
                };
                await idb.putAsset(asset);
                showUploadProgress(i + 1, images.length);
            }
            hideUploadProgress();
        }

        if (fileAssets.length > 0) {
            const FW = 240, FH = 90;
            const fileCols = Math.max(1, Math.min(6, Math.floor((window.innerWidth - 48) / (FW + GAP))));
            const fileDropY = dropY + (images.length > 0 ? Math.ceil(images.length / 6) * (280 + GAP) : 0);
            showUploadProgress(0, fileAssets.length);
            for (let i = 0; i < fileAssets.length; i++) {
                const file = fileAssets[i];
                lastPos += 1.0;
                const asset = {
                    boardId,
                    type: 'file',
                    position: lastPos,
                    createdAt: new Date(),
                    data: file,
                    name: file.name,
                    size: file.size,
                    mime: file.type || 'application/octet-stream',
                    x: dropX + (i % fileCols) * (FW + GAP),
                    y: fileDropY + Math.floor(i / fileCols) * (FH + GAP),
                };
                await idb.putAsset(asset);
                showUploadProgress(i + 1, fileAssets.length);
            }
            hideUploadProgress();
        }

        const total = images.length + fileAssets.length;
        if (total > 0) {
            showToast(`Added ${total} file${total > 1 ? 's' : ''}`);
            renderBoardView(boardId);
        }
    }

    // ─── SINGLE ASSET ───

    async function createSingleAsset(boardId, type) {
        const assets = await idb.getAssetsByBoard(boardId);
        const lastPos = assets.length > 0 ? Math.max(...assets.map(a => a.position)) : 0;
        const position = Math.floor(lastPos) + 1.0;

        let asset = { boardId, type, position, createdAt: new Date() };

        // Determine position
        const defaultX = state._pendingX !== null && state._pendingX !== undefined ? state._pendingX : 100 + Math.random() * 200;
        const defaultY = state._pendingY !== null && state._pendingY !== undefined ? state._pendingY : 100 + Math.random() * 200;
        asset.x = Math.round(defaultX);
        asset.y = Math.round(defaultY);

        switch (type) {
            case 'color': {
                const hex = $('#assetHex').value.trim();
                if (!hex || hex === '#') return showToast('Hex color is required');
                asset.hex = hex;
                asset.pantone = $('#assetPantone').value.trim() || undefined;
                break;
            }
            case 'link': {
                const url = $('#assetUrl').value.trim();
                if (!url) return showToast('URL is required');
                asset.url = url;
                asset.title = $('#assetLinkTitle').value.trim() || undefined;
                break;
            }
            case 'note': {
                const content = $('#assetNote').value.trim();
                if (!content) return showToast('Note content is required');
                asset.content = content;
                break;
            }
        }

        await idb.putAsset(asset);
        closeModal();
        state._pendingX = null;
        state._pendingY = null;
        showToast('Asset added');
        renderBoardView(boardId);
    }

    async function deleteAsset(assetId) {
        if (!confirm('Delete this asset?')) return;
        await idb.deleteAsset(assetId);
        showToast('Asset deleted');
        if (state.view === 'board' && state.currentBoardId) renderBoardView(state.currentBoardId);
    }

    async function deleteSelectedAssets() {
        const cards = state._selectedCards || [];
        if (cards.length === 0) return;
        const count = cards.length;
        // Inline confirmation
        const toolbar = $('#bulkDeleteToolbar');
        if (!toolbar) return;
        toolbar.innerHTML = `
            <span style="color:var(--text-secondary);font-size:0.8125rem;margin-right:8px">Delete ${count} asset${count > 1 ? 's' : ''}?</span>
            <button class="btn-danger" id="bulkDeleteConfirm">Confirm</button>
            <button class="btn-secondary" id="bulkDeleteCancel">Cancel</button>
        `;
        const confirmBtn = $('#bulkDeleteConfirm');
        const cancelBtn = $('#bulkDeleteCancel');
        if (confirmBtn) confirmBtn.onclick = async () => {
            for (const card of cards) {
                const assetId = parseInt(card.dataset.assetId);
                if (assetId) await idb.deleteAsset(assetId);
            }
            clearSelection();
            toolbar.innerHTML = '<button class="btn-danger" id="bulkDeleteBtn">Delete selected (0)</button>';
            toolbar.style.display = 'none';
            showToast(`${count} asset${count > 1 ? 's' : ''} deleted`);
            if (state.currentBoardId) renderBoardView(state.currentBoardId);
        };
        if (cancelBtn) cancelBtn.onclick = () => {
            toolbar.innerHTML = '<button class="btn-danger" id="bulkDeleteBtn">Delete selected (0)</button>';
            toolbar.style.display = 'none';
        };
    }

    // ─── UPLOAD PROGRESS ───

    function showUploadProgress(current, total) {
        let bar = $('#uploadProgressBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'uploadProgressBar';
            bar.className = 'upload-progress';
            bar.innerHTML = '<div class="spinner"></div><span id="uploadProgressText">Adding 0 of 0...</span>';
            document.body.appendChild(bar);
        }
        $('#uploadProgressText').textContent = `Adding ${current} of ${total}...`;
        bar.classList.add('visible');
    }

    function hideUploadProgress() {
        const bar = $('#uploadProgressBar');
        if (bar) {
            bar.classList.remove('visible');
            setTimeout(() => { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 400);
        }
    }

    // ─── SHARING (HTML Export) ───

    async function showShareModal(boardId) {
        const board = await idb.getBoard(boardId);
        if (!board) return;
        openModal(`
            <h3>Share: ${escHtml(board.name)}</h3>
            <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;">
                Generate a standalone HTML file with a read-only view of this board and all its contents.
            </p>
            <div class="modal-actions">
                <button onclick="App.closeModal()">Cancel</button>
                <button class="btn-primary" onclick="App.generateShareHTML(${boardId})">Generate Share File</button>
            </div>
        `);
    }

    async function generateShareHTML(boardId) {
        const board = await idb.getBoard(boardId);
        if (!board) return;
        const assets = await idb.getAssetsByBoard(boardId);
        const allBoards = await idb.getAllBoards();
        const subBoards = allBoards.filter(b => b.parentId === boardId);

        const now = new Date().toISOString().split('T')[0];

        function esc(s) {
            if (typeof s !== 'string') return '';
            return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(board.name)} &mdash; Hailure Brand Hub</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#111;color:#f0f0f0;padding:24px;max-width:800px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:4px}
.date{color:#666;font-size:0.8125rem;margin-bottom:24px}
h2{font-size:1rem;color:#c8a84e;margin-bottom:12px;margin-top:24px}
.asset{background:#222;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:8px}
.asset .label{color:#999;font-size:0.8125rem;margin-bottom:4px}
.color-swatch{width:60px;height:60px;border-radius:4px;border:1px solid #333;margin-bottom:8px}
.hex{font-family:monospace;font-weight:600}
.pantone{color:#666;font-size:0.75rem}
a{color:#c8a84e}
.note{white-space:pre-wrap;line-height:1.5}
.sub-board{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:12px 16px;margin-bottom:6px;color:#f0f0f0}
.empty{color:#666;font-size:0.875rem}
.file-info{color:#999;font-size:0.8125rem}
</style>
</head>
<body>
<h1>${esc(board.name)}</h1>
<p class="date">Shared from Hailure Brand Hub &mdash; ${now}</p>

${subBoards.length > 0 ? `<h2>Sub-Boards</h2>${subBoards.map(sb => `<div class="sub-board">${esc(sb.name)}</div>`).join('')}` : ''}

<h2>Assets</h2>
${assets.filter(a => a.type !== 'image').map(a => {
    switch (a.type) {
        case 'color': return '<div class="asset"><div class="color-swatch" style="background:'+esc(a.hex)+'"></div><div class="hex">'+(a.hex||'')+'</div>'+(a.pantone?'<div class="pantone">PN: '+esc(a.pantone)+'</div>':'')+'</div>';
        case 'link': return '<div class="asset"><a href="'+esc(a.url)+'" target="_blank" rel="noopener">'+(a.title||a.url)+'</a></div>';
        case 'note': return '<div class="asset"><div class="note">'+esc(a.content||'')+'</div></div>';
        case 'file': return '<div class="asset"><div class="file-info">📄 '+esc(a.name||'file')+ ' ('+formatSize(a.size||0)+')</div></div>';
        default: return '';
    }
}).join('')}
${assets.filter(a => a.type === 'image').length > 0 ? '<p class="empty">Images are not included in share exports.</p>' : ''}
${assets.length === 0 ? '<p class="empty">This board has no assets.</p>' : ''}

<p style="margin-top:40px;color:#666;font-size:0.75rem">Generated by Hailure Brand Hub</p>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hailure_Board_${board.name.replace(/[^a-z0-9]/gi, '_')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        closeModal();
        showToast('Share file downloaded');
    }

    // ─── EXPORT / IMPORT ───

    async function handleExport() {
        try {
            const data = await idb.exportAll();
            const json = JSON.stringify(data, (key, val) => {
                if (val instanceof Blob) return { __blob: true, type: val.type, size: val.size };
                return val;
            }, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Hailure_Brand_Hub_Backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Export downloaded');
        } catch (err) {
            showToast('Export failed: ' + err.message);
        }
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await idb.importAll(data);
            showToast('Import successful');
            if (state.currentBoardId) renderBoardView(state.currentBoardId);
            else renderDashboard();
        } catch (err) {
            showToast('Import failed: ' + err.message);
        }
        els.importInput.value = '';
    }

    // ─── HELPERS ───

    async function getAssetById(id) {
        const d = await idb.open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function openModal(html) {
        els.modalContent.innerHTML = html;
        els.modalOverlay.classList.add('open');
    }

    function closeModal() {
        els.modalOverlay.classList.remove('open');
    }

    function showToast(msg) {
        els.toast.textContent = msg;
        els.toast.classList.add('visible');
        clearTimeout(els.toast._timer);
        els.toast._timer = setTimeout(() => els.toast.classList.remove('visible'), 2500);
    }

    function updateNav() {
        $$('#headerNav button').forEach(b => {
            b.classList.toggle('active', b.dataset.view === state.view);
        });
    }

    function escHtml(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
    }

    // ─── INLINE LABEL EDITING ───

    async function saveAssetLabel(assetId, field, value) {
        const asset = await getAssetById(assetId);
        if (!asset) return;
        asset[field] = value;
        await idb.putAsset(asset);
    }

    // ─── IMAGE LIGHTBOX ───

    function buildImageList() {
        // Gather all image card elements in canvas, sorted by y then x
        const cards = $$('.canvas-card.card-image');
        return cards.map(c => {
            const assetId = parseInt(c.dataset.assetId);
            const img = c.querySelector('img');
            return { assetId, src: img ? img.src : '', label: img ? img.alt : '' };
        }).sort((a, b) => {
            const elA = cards.find(c => parseInt(c.dataset.assetId) === a.assetId);
            const elB = cards.find(c => parseInt(c.dataset.assetId) === b.assetId);
            if (!elA || !elB) return 0;
            const ay = parseFloat(elA.style.top) || 0;
            const by = parseFloat(elB.style.top) || 0;
            if (ay !== by) return ay - by;
            const ax = parseFloat(elA.style.left) || 0;
            const bx = parseFloat(elB.style.left) || 0;
            return ax - bx;
        });
    }

    let _lightboxIndex = -1;
    let _lightboxImages = [];

    function openLightbox(assetId) {
        _lightboxImages = buildImageList();
        const idx = _lightboxImages.findIndex(i => i.assetId === assetId);
        if (idx === -1) return;
        _lightboxIndex = idx;

        // Create lightbox DOM
        let overlay = $('#imageLightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'imageLightbox';
            overlay.className = 'image-lightbox';
            overlay.innerHTML = `
                <div class="lightbox-backdrop"></div>
                <button class="lightbox-close" id="lightboxClose">&times;</button>
                <button class="lightbox-nav lightbox-prev" id="lightboxPrev">&#8249;</button>
                <button class="lightbox-nav lightbox-next" id="lightboxNext">&#8250;</button>
                <div class="lightbox-content">
                    <img id="lightboxImg" src="" alt="">
                    <div class="lightbox-label" id="lightboxLabel"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Event listeners
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay || e.target.classList.contains('lightbox-backdrop')) {
                    closeLightbox();
                }
            });
            $('#lightboxClose').addEventListener('click', closeLightbox);
            $('#lightboxPrev').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
            $('#lightboxNext').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });
            window.addEventListener('keydown', onLightboxKeyDown);
        }

        showImage(idx);
        overlay.classList.add('open');
    }

    function closeLightbox() {
        const overlay = $('#imageLightbox');
        if (overlay) overlay.classList.remove('open');
        _lightboxIndex = -1;
        _lightboxImages = [];
    }

    function navigateLightbox(dir) {
        if (_lightboxImages.length === 0) return;
        _lightboxIndex = (_lightboxIndex + dir + _lightboxImages.length) % _lightboxImages.length;
        showImage(_lightboxIndex);
    }

    function showImage(idx) {
        const img = _lightboxImages[idx];
        if (!img) return;
        const el = $('#lightboxImg');
        const label = $('#lightboxLabel');
        if (el) el.src = img.src;
        if (label) label.textContent = img.label || 'untitled';
        // Update nav buttons visibility
        const prev = $('#lightboxPrev');
        const next = $('#lightboxNext');
        if (prev) prev.style.display = _lightboxImages.length > 1 ? '' : 'none';
        if (next) next.style.display = _lightboxImages.length > 1 ? '' : 'none';
    }

    function onLightboxKeyDown(e) {
        const overlay = $('#imageLightbox');
        if (!overlay || !overlay.classList.contains('open')) return;
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateLightbox(1);
        }
    }

    // ─── PUBLIC API ───
    return {
        init,
        navigateToDashboard,
        navigateToBoard,
        showNewBoardModal,
        createBoard,
        showEditBoardModal,
        renameBoard,
        deleteBoard,
        showAddAssetModal,
        onAssetTypeChange,
        createAsset,
        deleteAsset,
        showShareModal,
        generateShareHTML,
        togglePaletteView,
        fitToContent,
        regridBoard,
        openFile,
        closeModal,
    };
})();

document.addEventListener('DOMContentLoaded', () => App.init());