/**
 * Golden Grove — Profile Picture (DP) Selection & Interactive Cropper
 * Provides Option A (Built-in Gallery across 6 categories) and Option B (Upload & Interactive Crop).
 * Supports circular and rounded-square previews, zoom, pan, and real image assets.
 */

import { BUILTIN_AVATARS, AVATAR_CATEGORIES, filterBuiltinAvatars, resolveAvatarUrl, DEFAULT_AVATAR } from './avatars.js';
import { escapeHtml, formatFileSize } from './utils.js';

export class DpModalManager {
  constructor() {
    this.selectedAvatar = DEFAULT_AVATAR;
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.previewShape = 'circle'; // 'circle' | 'rounded'
    this.activeTab = 'gallery'; // 'gallery' | 'upload'

    // Cropper state
    this.cropImage = null;
    this.cropScale = 1;
    this.cropOffsetX = 0;
    this.cropOffsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.initialOffsetX = 0;
    this.initialOffsetY = 0;
  }

  /**
   * Opens the dedicated DP Selection modal.
   * @param {{ currentAvatar?: string, onSelect: (avatarUrl: string) => void, onCancel?: () => void }} options
   */
  open({ currentAvatar, onSelect, onCancel }) {
    this.selectedAvatar = resolveAvatarUrl(currentAvatar) || DEFAULT_AVATAR;
    this.activeTab = this.selectedAvatar.startsWith('data:image/') || this.selectedAvatar.startsWith('/api/avatars/')
      ? 'upload'
      : 'gallery';
    this.cropImage = null;

    const overlay = document.getElementById('groveModalOverlay');
    const card = document.getElementById('groveModalCard');
    if (!overlay || !card) return;

    const render = () => {
      card.innerHTML = this.renderModalHtml();
      this.bindEvents(onSelect, onCancel, render);
    };

    render();
    overlay.style.display = 'flex';
  }

  renderModalHtml() {
    const isGallery = this.activeTab === 'gallery';
    const filteredAvatars = filterBuiltinAvatars(this.currentCategory, this.searchQuery);
    const selectedObj = BUILTIN_AVATARS.find((a) => a.url === this.selectedAvatar) || {
      name: 'Custom Profile Picture',
      category: 'custom',
      description: 'Your uploaded and cropped avatar image.',
      url: this.selectedAvatar,
    };

    return `
      <div class="dp-modal-container" style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <div>
            <h3 class="modal-title-text">Select Profile Picture</h3>
            <span style="font-size: 12.5px; color: var(--secondary-text);">Choose a built-in artwork or upload your own photo</span>
          </div>
          <button class="modal-dismiss-btn" id="dpModalCloseBtn" aria-label="Close">✕</button>
        </div>

        <!-- Mode Toggle Tabs (Option A vs Option B) -->
        <div class="dp-mode-tabs-bar" style="margin: 12px 20px 8px;">
          <button class="dp-mode-tab ${isGallery ? 'active' : ''}" id="dpTabGallery">
            <span>🌿</span> Option A: Built-in Gallery
          </button>
          <button class="dp-mode-tab ${!isGallery ? 'active' : ''}" id="dpTabUpload">
            <span>📷</span> Option B: Upload & Crop
          </button>
        </div>

        <div class="grove-modal-body" style="padding-top: 8px;">
          ${
            isGallery
              ? `
            <!-- Option A: Built-in Gallery -->
            <div class="dp-gallery-section">
              <!-- Search & Category Filters -->
              <div class="dp-gallery-toolbar">
                <div class="dp-search-wrapper">
                  <span style="font-size: 14px;">🔍</span>
                  <input
                    type="text"
                    id="dpGallerySearchInput"
                    class="form-control-input dp-search-input"
                    placeholder="Search Nature, Animals, Minimal, etc..."
                    value="${escapeHtml(this.searchQuery)}"
                  />
                  ${this.searchQuery ? `<button id="dpClearSearchBtn" class="search-clear-icon" style="display:block;">✕</button>` : ''}
                </div>

                <div class="dp-shape-toggle-group">
                  <span style="font-size: 12px; font-weight: 700; color: var(--secondary-text);">Preview:</span>
                  <button class="dp-shape-btn ${this.previewShape === 'circle' ? 'active' : ''}" id="dpShapeCircleBtn" title="Circle shape">
                    <span class="shape-indicator circle"></span> Circle
                  </button>
                  <button class="dp-shape-btn ${this.previewShape === 'rounded' ? 'active' : ''}" id="dpShapeRoundedBtn" title="Rounded square shape">
                    <span class="shape-indicator rounded"></span> Square
                  </button>
                </div>
              </div>

              <!-- Category Pills -->
              <div class="dp-categories-scroll">
                ${AVATAR_CATEGORIES.map(
                  (c) => `
                  <button class="dp-cat-pill ${this.currentCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
                    <span>${c.icon}</span> ${c.label}
                  </button>
                `
                ).join('')}
              </div>

              <!-- Main Gallery + Preview Split -->
              <div class="dp-gallery-layout">
                <!-- Avatars Grid -->
                <div class="dp-avatars-grid">
                  <!-- Default Grove Emblem -->
                  <div class="dp-grid-item ${this.selectedAvatar === DEFAULT_AVATAR ? 'selected' : ''}" data-url="${DEFAULT_AVATAR}">
                    <div class="dp-grid-thumb ${this.previewShape}">
                      <img src="${DEFAULT_AVATAR}" alt="Golden Grove Default" loading="lazy" />
                    </div>
                    <span class="dp-grid-label">Grove Emblem</span>
                  </div>

                  ${filteredAvatars
                    .map(
                      (av) => `
                    <div class="dp-grid-item ${this.selectedAvatar === av.url ? 'selected' : ''}" data-url="${av.url}" title="${escapeHtml(av.description)}">
                      <div class="dp-grid-thumb ${this.previewShape}">
                        <img src="${av.url}" alt="${escapeHtml(av.name)}" loading="lazy" />
                      </div>
                      <span class="dp-grid-label">${escapeHtml(av.name)}</span>
                    </div>
                  `
                    )
                    .join('')}
                </div>

                <!-- Right / Bottom Preview Card -->
                <div class="dp-preview-sidecard">
                  <div class="dp-preview-large ${this.previewShape}">
                    <img src="${this.selectedAvatar}" alt="Selected Avatar" id="dpSelectedLargePreview" />
                  </div>
                  <h4 class="dp-preview-name">${escapeHtml(selectedObj.name)}</h4>
                  <span class="dp-preview-cat-badge">${selectedObj.category.toUpperCase()}</span>
                  <p class="dp-preview-desc">${escapeHtml(selectedObj.description)}</p>
                </div>
              </div>
            </div>
          `
              : `
            <!-- Option B: Upload & Crop -->
            <div class="dp-upload-section">
              <input type="file" id="dpFileInput" accept="image/jpeg,image/png,image/webp" style="display: none;" />

              ${
                !this.cropImage
                  ? `
                <div class="dp-upload-dropzone" id="dpDropzone">
                  <div class="dp-drop-icon">📷</div>
                  <h4 style="font-size: 16px; font-weight: 800; color: var(--main-text); margin-bottom: 4px;">Upload Your Profile Picture</h4>
                  <p style="font-size: 12.5px; color: var(--secondary-text); margin-bottom: 14px;">
                    Supports high-resolution JPG, PNG, and WebP (up to 5 MB)
                  </p>
                  <button type="button" class="btn-grove btn-golden" id="dpBrowseBtn">
                    Choose Photo From Device
                  </button>
                  <div id="dpUploadError" class="staged-error-text" style="display: none; margin-top: 10px;"></div>
                </div>
              `
                  : `
                <!-- Interactive Canvas Cropper Workspace -->
                <div class="dp-cropper-workspace">
                  <div class="dp-cropper-stage">
                    <canvas id="dpCropCanvas" width="300" height="300" class="dp-crop-canvas"></canvas>
                    <div class="dp-crop-mask-overlay ${this.previewShape}"></div>
                  </div>

                  <!-- Cropper Controls -->
                  <div class="dp-cropper-controls">
                    <div class="dp-zoom-row">
                      <span style="font-size: 14px;">🔍</span>
                      <button type="button" class="staged-ctrl-btn" id="dpZoomOutBtn" title="Zoom Out">−</button>
                      <input type="range" id="dpZoomSlider" min="1" max="3" step="0.05" value="${this.cropScale}" class="dp-zoom-slider" />
                      <button type="button" class="staged-ctrl-btn" id="dpZoomInBtn" title="Zoom In">+</button>
                    </div>

                    <p style="font-size: 11.5px; color: var(--secondary-text); margin-top: 4px; text-align: center;">
                      Drag image to reposition • Slider to zoom
                    </p>

                    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
                      <button type="button" class="btn-grove btn-outline btn-sm-g" id="dpCropReplaceBtn">
                        Replace Photo
                      </button>
                      <button type="button" class="btn-grove btn-outline btn-sm-g" id="dpCropResetBtn">
                        Reset Position
                      </button>
                      <button type="button" class="btn-grove btn-danger-soft btn-sm-g" id="dpRemoveCustomBtn">
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              `
              }
            </div>
          `
          }
        </div>

        <div class="grove-modal-footer" style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <button type="button" class="btn-grove btn-outline" id="dpCancelBtn">Cancel</button>
          <button type="button" class="btn-grove btn-golden" id="dpApplyBtn" style="min-width: 150px;">
            Apply Profile Picture
          </button>
        </div>
      </div>
    `;
  }

  bindEvents(onSelect, onCancel, render) {
    // Close / Dismiss
    document.getElementById('dpModalCloseBtn')?.addEventListener('click', () => {
      this.close();
      onCancel?.();
    });
    document.getElementById('dpCancelBtn')?.addEventListener('click', () => {
      this.close();
      onCancel?.();
    });

    // Tab switcher
    document.getElementById('dpTabGallery')?.addEventListener('click', () => {
      this.activeTab = 'gallery';
      render();
    });
    document.getElementById('dpTabUpload')?.addEventListener('click', () => {
      this.activeTab = 'upload';
      render();
    });

    // Gallery Events
    if (this.activeTab === 'gallery') {
      const searchInput = document.getElementById('dpGallerySearchInput');
      searchInput?.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        render();
      });

      document.getElementById('dpClearSearchBtn')?.addEventListener('click', () => {
        this.searchQuery = '';
        render();
      });

      // Category filter pills
      document.querySelectorAll('.dp-cat-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.currentCategory = btn.dataset.cat;
          render();
        });
      });

      // Shape preview buttons
      document.getElementById('dpShapeCircleBtn')?.addEventListener('click', () => {
        this.previewShape = 'circle';
        render();
      });
      document.getElementById('dpShapeRoundedBtn')?.addEventListener('click', () => {
        this.previewShape = 'rounded';
        render();
      });

      // Item selection
      document.querySelectorAll('.dp-grid-item').forEach((item) => {
        item.addEventListener('click', () => {
          this.selectedAvatar = item.dataset.url;
          render();
        });
      });
    }

    // Upload & Crop Events
    if (this.activeTab === 'upload') {
      const fileInput = document.getElementById('dpFileInput');
      const browseBtn = document.getElementById('dpBrowseBtn');
      const dropzone = document.getElementById('dpDropzone');
      const errorEl = document.getElementById('dpUploadError');

      const handleFile = (file) => {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          if (errorEl) {
            errorEl.textContent = 'Unsupported format. Please select a JPG, PNG, or WebP image.';
            errorEl.style.display = 'block';
          }
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          if (errorEl) {
            errorEl.textContent = `File size (${formatFileSize(file.size)}) exceeds the 5 MB limit.`;
            errorEl.style.display = 'block';
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            this.cropImage = img;
            this.cropScale = 1;
            this.cropOffsetX = 0;
            this.cropOffsetY = 0;
            render();
            this.initCanvasCropper();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };

      browseBtn?.addEventListener('click', () => fileInput?.click());
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        handleFile(file);
      });

      if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-active');
        });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
        dropzone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-active');
          const file = e.dataTransfer?.files?.[0];
          handleFile(file);
        });
      }

      if (this.cropImage) {
        this.initCanvasCropper();

        document.getElementById('dpCropReplaceBtn')?.addEventListener('click', () => {
          fileInput?.click();
        });

        document.getElementById('dpCropResetBtn')?.addEventListener('click', () => {
          this.cropScale = 1;
          this.cropOffsetX = 0;
          this.cropOffsetY = 0;
          const slider = document.getElementById('dpZoomSlider');
          if (slider) slider.value = '1';
          this.drawCropCanvas();
        });

        document.getElementById('dpRemoveCustomBtn')?.addEventListener('click', () => {
          this.cropImage = null;
          this.selectedAvatar = DEFAULT_AVATAR;
          this.activeTab = 'gallery';
          render();
        });

        // Zoom controls
        const zoomSlider = document.getElementById('dpZoomSlider');
        zoomSlider?.addEventListener('input', (e) => {
          this.cropScale = parseFloat(e.target.value);
          this.drawCropCanvas();
        });

        document.getElementById('dpZoomOutBtn')?.addEventListener('click', () => {
          this.cropScale = Math.max(1, this.cropScale - 0.2);
          if (zoomSlider) zoomSlider.value = String(this.cropScale);
          this.drawCropCanvas();
        });

        document.getElementById('dpZoomInBtn')?.addEventListener('click', () => {
          this.cropScale = Math.min(3, this.cropScale + 0.2);
          if (zoomSlider) zoomSlider.value = String(this.cropScale);
          this.drawCropCanvas();
        });
      }
    }

    // Apply Button
    document.getElementById('dpApplyBtn')?.addEventListener('click', async () => {
      let finalAvatarUrl = this.selectedAvatar;

      if (this.activeTab === 'upload' && this.cropImage) {
        // Render final 320x320 crop
        finalAvatarUrl = this.exportCroppedSquareDataUrl();
      }

      this.close();
      onSelect?.(finalAvatarUrl);
    });
  }

  initCanvasCropper() {
    const canvas = document.getElementById('dpCropCanvas');
    if (!canvas || !this.cropImage) return;

    this.drawCropCanvas();

    // Mouse / Touch Dragging for Panning
    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.dragStartX = clientX;
      this.dragStartY = clientY;
      this.initialOffsetX = this.cropOffsetX;
      this.initialOffsetY = this.cropOffsetY;
      canvas.style.cursor = 'grabbing';
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStartX;
      const dy = clientY - this.dragStartY;
      this.cropOffsetX = this.initialOffsetX + dx;
      this.cropOffsetY = this.initialOffsetY + dy;
      this.drawCropCanvas();
    };

    const onEnd = () => {
      this.isDragging = false;
      canvas.style.cursor = 'grab';
    };

    canvas.onmousedown = (e) => onStart(e.clientX, e.clientY);
    window.onmousemove = (e) => onMove(e.clientX, e.clientY);
    window.onmouseup = onEnd;

    canvas.ontouchstart = (e) => {
      if (e.touches.length === 1) {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.ontouchmove = (e) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    window.ontouchend = onEnd;
  }

  drawCropCanvas() {
    const canvas = document.getElementById('dpCropCanvas');
    if (!canvas || !this.cropImage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // Calculate aspect ratio covering the canvas
    const img = this.cropImage;
    const scale = Math.max(cw / img.width, ch / img.height) * this.cropScale;
    const w = img.width * scale;
    const h = img.height * scale;

    // Center plus offset
    const x = (cw - w) / 2 + this.cropOffsetX;
    const y = (ch - h) / 2 + this.cropOffsetY;

    ctx.drawImage(img, x, y, w, h);
  }

  exportCroppedSquareDataUrl() {
    if (!this.cropImage) return this.selectedAvatar;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 320;
    outCanvas.height = 320;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return this.selectedAvatar;

    const img = this.cropImage;
    const baseScale = Math.max(300 / img.width, 300 / img.height);
    const scale = baseScale * this.cropScale;
    const w = img.width * scale;
    const h = img.height * scale;

    const normX = ((300 - w) / 2 + this.cropOffsetX) / 300;
    const normY = ((300 - h) / 2 + this.cropOffsetY) / 300;

    const finalW = 320 * (w / 300);
    const finalH = 320 * (h / 300);
    const finalX = normX * 320;
    const finalY = normY * 320;

    ctx.drawImage(img, finalX, finalY, finalW, finalH);
    return outCanvas.toDataURL('image/jpeg', 0.92);
  }

  close() {
    const overlay = document.getElementById('groveModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }
}

export const dpModal = new DpModalManager();
