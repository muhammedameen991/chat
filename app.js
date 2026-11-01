/**
 * Golden Grove - Production Real-Time Peer-to-Peer Messaging Application
 * Application Bootstrap Entrypoint
 */

import './style.css';
import { ui } from './js/ui.js';
import { auth } from './js/auth.js';
import { storage } from './js/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize local IndexedDB storage
    await storage.init();

    // 2. Initialize UI layout and listeners
    ui.init();

    // 3. Register Service Worker for PWA compliance
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Golden Grove Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });
    }

    // 4. Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Escape to close open modal
      if (e.key === 'Escape') {
        const modal = document.getElementById('groveModalOverlay');
        if (modal && modal.style.display !== 'none') {
          ui.hideModal();
        }
      }

      // Cmd+K or Ctrl+K to open friend search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        ui.openSearchModal();
      }
    });

    console.log('Golden Grove loaded successfully.');
  } catch (err) {
    console.error('Golden Grove initialization error:', err);
  }
});
