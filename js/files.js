/**
 * Golden Grove — Client-side Advanced File Sharing & Chunked Upload Manager
 * Handles multi-file staging, chunked resumable uploads (1 MB slices),
 * pause/resume/retry/cancel controls, and client-side security validation.
 */

import {
  MAX_FILE_SIZE_BYTES,
  UPLOAD_CHUNK_SIZE_BYTES,
  getFileExtension,
  isBlockedExtension,
  sanitizeFileName,
  getFileCategory,
  getFileCategoryBadge,
  calculateChunks,
  formatFileSize,
} from './utils.js';

export class FileManager {
  constructor() {
    /** @type {Array<any>} */
    this.stagedFiles = [];
    this.activeUploads = new Map();
  }

  /**
   * Clears the current staging queue.
   */
  clearStaged() {
    this.stagedFiles.forEach((item) => {
      if (item.abortController) {
        item.abortController.abort();
      }
      if (item.previewObjectUrl) {
        URL.revokeObjectURL(item.previewObjectUrl);
      }
    });
    this.stagedFiles = [];
  }

  /**
   * Adds files from input or drag-and-drop to staging queue with security validation.
   * @param {FileList | File[]} files
   * @returns {{ addedCount: number, errors: string[] }}
   */
  addFiles(files) {
    const fileList = Array.from(files || []);
    const errors = [];
    let addedCount = 0;

    for (const file of fileList) {
      const ext = getFileExtension(file.name);
      const category = getFileCategory(file.name, file.type);
      const id = `staged_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let previewObjectUrl = null;
      if (category === 'image' || category === 'video') {
        try {
          previewObjectUrl = URL.createObjectURL(file);
        } catch {
          // Object URL not supported or failed
        }
      }

      const item = {
        id,
        file,
        name: file.name,
        sanitizedName: sanitizeFileName(file.name),
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        extension: ext,
        category,
        badge: getFileCategoryBadge(category),
        previewObjectUrl,
        status: 'queued', // 'queued' | 'uploading' | 'paused' | 'completed' | 'failed'
        progress: 0,
        chunksTotal: Math.ceil(file.size / UPLOAD_CHUNK_SIZE_BYTES) || 1,
        chunksUploaded: 0,
        errorMsg: '',
        fileId: null,
        downloadUrl: null,
        previewUrl: null,
        isPaused: false,
        abortController: null,
      };

      // Security validations
      if (isBlockedExtension(file.name)) {
        item.status = 'failed';
        item.errorMsg = `Executable file extension "${ext}" is blocked for security.`;
        errors.push(`${file.name}: Executable extension blocked.`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        item.status = 'failed';
        item.errorMsg = `File size (${formatFileSize(file.size)}) exceeds the 50 MB limit.`;
        errors.push(`${file.name}: Exceeds 50 MB maximum size limit.`);
      } else if (file.size <= 0) {
        item.status = 'failed';
        item.errorMsg = 'File is empty (0 Bytes).';
        errors.push(`${file.name}: File is empty.`);
      }

      this.stagedFiles.push(item);
      addedCount++;
    }

    return { addedCount, errors };
  }

  /**
   * Removes an item from the staging list and aborts if in progress.
   * @param {string} id
   */
  removeFile(id) {
    const idx = this.stagedFiles.findIndex((f) => f.id === id);
    if (idx >= 0) {
      const item = this.stagedFiles[idx];
      if (item.abortController) {
        item.abortController.abort();
      }
      if (item.fileId) {
        fetch(`/api/files/${item.fileId}/cancel`, { method: 'POST' }).catch(() => {});
      }
      if (item.previewObjectUrl) {
        URL.revokeObjectURL(item.previewObjectUrl);
      }
      this.stagedFiles.splice(idx, 1);
    }
  }

  /**
   * Pauses an active upload.
   * @param {string} id
   */
  pauseUpload(id) {
    const item = this.stagedFiles.find((f) => f.id === id);
    if (item && item.status === 'uploading') {
      item.isPaused = true;
      item.status = 'paused';
      if (item.abortController) {
        item.abortController.abort();
        item.abortController = null;
      }
    }
  }

  /**
   * Resumes or retries an upload.
   * @param {string} id
   * @param {string} sender
   * @param {string} recipient
   * @param {(item: any) => void} onUpdate
   */
  async resumeUpload(id, sender, recipient, onUpdate) {
    const item = this.stagedFiles.find((f) => f.id === id);
    if (item && (item.status === 'paused' || item.status === 'failed')) {
      item.isPaused = false;
      item.errorMsg = '';
      await this.uploadItem(item, sender, recipient, onUpdate);
    }
  }

  /**
   * Uploads a single file item using chunked slices (1 MB each).
   * @param {any} item
   * @param {string} sender
   * @param {string} recipient
   * @param {(item: any) => void} onUpdate
   */
  async uploadItem(item, sender, recipient, onUpdate) {
    if (item.status === 'completed' || isBlockedExtension(item.name) || item.size > MAX_FILE_SIZE_BYTES) {
      return item;
    }

    item.status = 'uploading';
    item.isPaused = false;
    item.abortController = new AbortController();
    onUpdate?.(item);

    try {
      // Step 1: Initialize session on backend if not already created
      if (!item.fileId) {
        const initRes = await fetch('/api/files/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.name,
            fileSize: item.size,
            mimeType: item.mimeType,
            sender,
            recipient,
          }),
          signal: item.abortController.signal,
        });

        if (!initRes.ok) {
          const errData = await initRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload init failed (${initRes.status})`);
        }

        const initData = await initRes.json();
        item.fileId = initData.fileId;
        item.sanitizedName = initData.sanitizedName;
      }

      // Step 2: Query status to check which chunks are already uploaded (for resuming)
      let uploadedChunks = [];
      try {
        const statusRes = await fetch(`/api/files/${item.fileId}/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          uploadedChunks = statusData.uploadedChunks || [];
          item.chunksUploaded = uploadedChunks.length;
        }
      } catch {
        // Ignored
      }

      // Step 3: Upload chunks sequentially
      const totalChunks = item.chunksTotal;

      for (let i = 0; i < totalChunks; i++) {
        if (item.isPaused) {
          item.status = 'paused';
          onUpdate?.(item);
          return item;
        }

        // Skip if chunk already confirmed
        if (uploadedChunks.includes(i)) {
          continue;
        }

        const start = i * UPLOAD_CHUNK_SIZE_BYTES;
        const end = Math.min(item.size, start + UPLOAD_CHUNK_SIZE_BYTES);
        const sliceBlob = item.file.slice(start, end);

        // Convert slice blob to base64
        const chunkBase64 = await this.readBlobAsBase64(sliceBlob);

        const chunkRes = await fetch('/api/files/chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: item.fileId,
            chunkIndex: i,
            chunkData: chunkBase64,
            sender,
          }),
          signal: item.abortController.signal,
        });

        if (!chunkRes.ok) {
          const errData = await chunkRes.json().catch(() => ({}));
          throw new Error(errData.error || `Chunk ${i + 1} upload failed`);
        }

        const chunkResult = await chunkRes.json();
        uploadedChunks.push(i);
        item.chunksUploaded = uploadedChunks.length;
        item.progress = Math.round((item.chunksUploaded / totalChunks) * 100);

        if (chunkResult.complete) {
          item.status = 'completed';
          item.progress = 100;
          item.downloadUrl = chunkResult.downloadUrl;
          item.previewUrl = chunkResult.previewUrl;
          onUpdate?.(item);
          return item;
        }

        onUpdate?.(item);
      }

      item.status = 'completed';
      item.progress = 100;
      item.downloadUrl = `/api/files/${item.fileId}/download`;
      item.previewUrl = `/api/files/${item.fileId}/preview`;
      onUpdate?.(item);
      return item;
    } catch (err) {
      if (item.isPaused) {
        item.status = 'paused';
      } else {
        item.status = 'failed';
        item.errorMsg = err.message || 'Upload failed';
      }
      onUpdate?.(item);
      return item;
    }
  }

  /**
   * Helper to convert blob chunk to pure base64 string.
   * @param {Blob} blob
   * @returns {Promise<string>}
   */
  readBlobAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // Strip data:application/octet-stream;base64, prefix
        const base64 = typeof result === 'string' ? result.split(',')[1] : '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Uploads all queued and uncompleted items.
   * @param {string} sender
   * @param {string} recipient
   * @param {(item: any) => void} onUpdate
   * @returns {Promise<Array<any>>} Array of completed file records
   */
  async uploadAll(sender, recipient, onUpdate) {
    const eligible = this.stagedFiles.filter(
      (f) => f.status === 'queued' || f.status === 'failed' || f.status === 'paused'
    );

    for (const item of eligible) {
      await this.uploadItem(item, sender, recipient, onUpdate);
    }

    return this.stagedFiles.filter((f) => f.status === 'completed');
  }
}

export const fileManager = new FileManager();
