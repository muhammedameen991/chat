import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFileExtension,
  isBlockedExtension,
  sanitizeFileName,
  getFileCategory,
  getFileCategoryBadge,
  calculateChunks,
  createChatMessage,
  formatFileSize,
} from '../js/utils.js';

test('getFileExtension accurately extracts normalized extension', () => {
  assert.equal(getFileExtension('document.pdf'), '.pdf');
  assert.equal(getFileExtension('ARCHIVE.TAR.GZ'), '.gz');
  assert.equal(getFileExtension('photo.JPEG'), '.jpeg');
  assert.equal(getFileExtension('no_extension'), '');
  assert.equal(getFileExtension('.gitignore'), '.gitignore');
});

test('isBlockedExtension correctly flags dangerous executable types', () => {
  assert.equal(isBlockedExtension('trojan.exe'), true);
  assert.equal(isBlockedExtension('script.bat'), true);
  assert.equal(isBlockedExtension('run.sh'), true);
  assert.equal(isBlockedExtension('malware.vbs'), true);
  assert.equal(isBlockedExtension('exploit.php'), true);
  assert.equal(isBlockedExtension('installer.msi'), true);

  // Safe files allowed
  assert.equal(isBlockedExtension('report.pdf'), false);
  assert.equal(isBlockedExtension('presentation.pptx'), false);
  assert.equal(isBlockedExtension('dataset.csv'), false);
  assert.equal(isBlockedExtension('archive.zip'), false);
  assert.equal(isBlockedExtension('image.png'), false);
  assert.equal(isBlockedExtension('song.mp3'), false);
});

test('sanitizeFileName removes path traversal and dangerous characters', () => {
  assert.equal(sanitizeFileName('../../../etc/passwd.txt'), 'etc_passwd.txt');
  assert.equal(sanitizeFileName('..\\..\\windows\\system32.dll'), 'windows_system32.dll');
  assert.equal(sanitizeFileName('normal_file.pdf'), 'normal_file.pdf');
  assert.equal(sanitizeFileName('my report (final) 2026.docx'), 'my report (final) 2026.docx');
  assert.equal(sanitizeFileName('').startsWith('file_'), true);
  assert.equal(sanitizeFileName('a'.repeat(200) + '.png').length <= 85, true);
});

test('getFileCategory categorizes multiple file types accurately', () => {
  assert.equal(getFileCategory('pic.png', 'image/png'), 'image');
  assert.equal(getFileCategory('clip.mp4', 'video/mp4'), 'video');
  assert.equal(getFileCategory('podcast.mp3', 'audio/mpeg'), 'audio');
  assert.equal(getFileCategory('handbook.pdf', 'application/pdf'), 'pdf');
  assert.equal(getFileCategory('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'document');
  assert.equal(getFileCategory('readme.txt', 'text/plain'), 'document');
  assert.equal(getFileCategory('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'sheet');
  assert.equal(getFileCategory('pitch.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'presentation');
  assert.equal(getFileCategory('backup.zip', 'application/zip'), 'archive');
  assert.equal(getFileCategory('source.ts', 'text/typescript'), 'code');
  assert.equal(getFileCategory('kernel.bin', 'application/octet-stream'), 'generic');
});

test('getFileCategoryBadge returns distinct UI indicators', () => {
  const pdfBadge = getFileCategoryBadge('pdf');
  assert.equal(pdfBadge.label, 'PDF');
  assert.equal(pdfBadge.icon, '📕');

  const videoBadge = getFileCategoryBadge('video');
  assert.equal(videoBadge.label, 'Video');
  assert.equal(videoBadge.icon, '🎬');

  const archiveBadge = getFileCategoryBadge('archive');
  assert.equal(archiveBadge.label, 'Archive');
  assert.equal(archiveBadge.icon, '📦');
});

test('calculateChunks divides files into 1MB chunks', () => {
  const oneMb = 1024 * 1024;
  assert.deepEqual(calculateChunks(500 * 1024, oneMb), { totalChunks: 1, chunkSize: oneMb });
  assert.deepEqual(calculateChunks(2.5 * oneMb, oneMb), { totalChunks: 3, chunkSize: oneMb });
  assert.deepEqual(calculateChunks(50 * oneMb, oneMb), { totalChunks: 50, chunkSize: oneMb });
  assert.deepEqual(calculateChunks(0, oneMb), { totalChunks: 0, chunkSize: oneMb });
});

test('createChatMessage supports both files list and backward-compatible file object', () => {
  const file1 = { id: 'f1', name: 'photo.jpg', size: 1024, mimeType: 'image/jpeg' };
  const file2 = { id: 'f2', name: 'report.pdf', size: 2048, mimeType: 'application/pdf' };

  const msg = createChatMessage({
    sender: 'alice',
    recipient: 'bob',
    text: 'Here are the documents',
    files: [file1, file2],
  });

  assert.equal(msg.files.length, 2);
  assert.equal(msg.file?.name, 'photo.jpg');
  assert.equal(msg.text, 'Here are the documents');
});
