import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername,
  validateDisplayName,
  transitionMessageStatus,
  createChatMessage,
  escapeHtml,
  filterUsers,
  validateSignalingMessage,
  formatFileSize,
  toggleReaction,
  calculatePollVotes,
  formatVoiceDuration,
  highlightSearchMatch,
  validateFullName,
  validatePassword,
  evaluatePasswordStrength,
} from '../js/utils.js';

test('validateUsername handles valid usernames correctly', () => {
  const result1 = validateUsername('alice');
  assert.equal(result1.valid, true);
  assert.equal(result1.sanitized, 'alice');

  const result2 = validateUsername(' Bob_99 ');
  assert.equal(result2.valid, true);
  assert.equal(result2.sanitized, 'bob_99');
});

test('validateUsername rejects invalid usernames', () => {
  assert.equal(validateUsername('al').valid, false); // too short
  assert.equal(validateUsername('a'.repeat(25)).valid, false); // too long
  assert.equal(validateUsername('alice-bob').valid, false); // invalid hyphen
  assert.equal(validateUsername('alice bob').valid, false); // space
  assert.equal(validateUsername('admin').valid, false); // reserved
  assert.equal(validateUsername('meshchat').valid, false); // reserved
});

test('validateDisplayName validates properly', () => {
  assert.equal(validateDisplayName('Alice Wonderland').valid, true);
  assert.equal(validateDisplayName('').valid, false);
  assert.equal(validateDisplayName('   ').valid, false);
});

test('transitionMessageStatus enforces unidirectional progress', () => {
  assert.equal(transitionMessageStatus('sending', 'sent'), 'sent');
  assert.equal(transitionMessageStatus('sent', 'delivered'), 'delivered');
  assert.equal(transitionMessageStatus('delivered', 'read'), 'read');
  // Cannot downgrade from read back to delivered
  assert.equal(transitionMessageStatus('read', 'delivered'), 'read');
  assert.equal(transitionMessageStatus('delivered', 'sent'), 'delivered');
  // Can fail
  assert.equal(transitionMessageStatus('sending', 'failed'), 'failed');
  // Can retry from failed
  assert.equal(transitionMessageStatus('failed', 'sending'), 'sending');
});

test('createChatMessage builds valid structure', () => {
  const msg = createChatMessage({
    sender: 'Alice',
    recipient: 'Bob',
    text: 'Hello, Bob!',
  });
  assert.equal(msg.sender, 'alice');
  assert.equal(msg.recipient, 'bob');
  assert.equal(msg.text, 'Hello, Bob!');
  assert.equal(msg.status, 'sending');
  assert.ok(msg.id.startsWith('msg_'));
  assert.ok(msg.timestamp > 0);
});

test('escapeHtml prevents XSS injections', () => {
  const raw = '<script>alert("xss")</script>&"test"';
  const escaped = escapeHtml(raw);
  assert.equal(escaped.includes('<script>'), false);
  assert.equal(escaped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;test&quot;');
});

test('filterUsers filters by username and displayName case-insensitively', () => {
  const users = [
    { username: 'alice', displayName: 'Alice Liddell', avatar: '1.svg' },
    { username: 'bob', displayName: 'Robert Smith', avatar: '2.svg' },
    { username: 'carol', displayName: 'Carol Danvers', avatar: '3.svg' },
  ];

  // Self excluded
  const result1 = filterUsers(users, '', 'alice');
  assert.equal(result1.length, 2);
  assert.equal(result1.some((u) => u.username === 'alice'), false);

  // Search by username
  const result2 = filterUsers(users, 'bo', 'alice');
  assert.equal(result2.length, 1);
  assert.equal(result2[0].username, 'bob');

  // Search by display name
  const result3 = filterUsers(users, 'danvers', 'alice');
  assert.equal(result3.length, 1);
  assert.equal(result3[0].username, 'carol');
});

test('validateSignalingMessage validates envelopes', () => {
  assert.equal(
    validateSignalingMessage({
      from: 'alice',
      to: 'bob',
      type: 'offer',
      payload: { sdp: 'fake' },
      timestamp: Date.now(),
    }).valid,
    true
  );

  assert.equal(validateSignalingMessage(null).valid, false);
  assert.equal(validateSignalingMessage({ from: 'alice', to: 'bob', type: 'unknown' }).valid, false);
});

test('formatFileSize formats human readable sizes', () => {
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(1048576 * 3.5), '3.5 MB');
});

test('toggleReaction adds and removes user emoji reactions properly', () => {
  let reactions: Record<string, string[]> = {};
  reactions = toggleReaction(reactions, '❤️', 'alice');
  assert.deepEqual(reactions['❤️'], ['alice']);

  // Bob also reacts
  reactions = toggleReaction(reactions, '❤️', 'bob');
  assert.deepEqual(reactions['❤️'], ['alice', 'bob']);

  // Alice un-reacts
  reactions = toggleReaction(reactions, '❤️', 'alice');
  assert.deepEqual(reactions['❤️'], ['bob']);

  // Bob un-reacts -> key cleaned up
  reactions = toggleReaction(reactions, '❤️', 'bob');
  assert.equal(reactions['❤️'], undefined);
});

test('calculatePollVotes calculates percentages and user vote state', () => {
  const poll = {
    question: 'Favorite Grove season?',
    options: [
      { id: 'opt1', text: 'Spring Bloom', votes: ['alice', 'bob'] },
      { id: 'opt2', text: 'Golden Autumn', votes: ['carol'] },
      { id: 'opt3', text: 'Summer Sunlight', votes: [] },
    ],
  };

  const res = calculatePollVotes(poll, 'alice');
  assert.equal(res.totalVotes, 3);
  assert.equal(res.userVotedId, 'opt1');
  assert.equal(res.options[0].percentage, 67);
  assert.equal(res.options[0].isUserVote, true);
  assert.equal(res.options[1].percentage, 33);
  assert.equal(res.options[2].percentage, 0);
});

test('formatVoiceDuration formats mm:ss accurately', () => {
  assert.equal(formatVoiceDuration(0), '0:00');
  assert.equal(formatVoiceDuration(5), '0:05');
  assert.equal(formatVoiceDuration(68), '1:08');
  assert.equal(formatVoiceDuration(605), '10:05');
});

test('highlightSearchMatch highlights search term with safe markup', () => {
  const text = 'Welcome to Golden Grove Haven';
  const out = highlightSearchMatch(text, 'Grove');
  assert.ok(out.includes('<mark class="search-highlight">Grove</mark>'));
});

test('validateFullName requires minimum 2 characters', () => {
  assert.equal(validateFullName('A').valid, false);
  assert.equal(validateFullName('').valid, false);
  assert.equal(validateFullName('   ').valid, false);
  const ok = validateFullName('Ameen Grove');
  assert.equal(ok.valid, true);
  assert.equal(ok.sanitized, 'Ameen Grove');
});

test('validatePassword enforces security rules', () => {
  // Too short
  assert.equal(validatePassword('abc1').valid, false);
  // Missing numbers
  assert.equal(validatePassword('secretpass').valid, false);
  // Missing letters
  assert.equal(validatePassword('12345678').valid, false);
  // Valid
  assert.equal(validatePassword('Grove2026').valid, true);
});

test('evaluatePasswordStrength computes score and color bands correctly', () => {
  const weak = evaluatePasswordStrength('abc');
  assert.equal(weak.label, 'Weak');

  const fair = evaluatePasswordStrength('grove1');
  assert.equal(fair.label, 'Fair');

  const strong = evaluatePasswordStrength('GroveSecret#2026');
  assert.equal(strong.label, 'Strong');
  assert.equal(strong.percent, 100);
});


