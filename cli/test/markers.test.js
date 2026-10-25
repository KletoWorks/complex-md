// Marked blocks: what complex-md writes into a file the user owns sits
// between a begin and an end marker. A rewrite replaces only the marked
// text, and removal takes out exactly the bytes that were added.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markerLines, findRegion, upsertRegion, removeRegion, eolOf, normalizedHash } from '../src/markers.js';

const CONTENT = 'Read COMPLEX.md before you edit a file it lists.\n';

test('the markers name the tool and the spec version, in the comment style of the file', () => {
  assert.deepEqual(markerLines('html', '0.3'), { begin: '<!-- BEGIN complex-md (spec 0.3) -->', end: '<!-- END complex-md (spec 0.3) -->' });
  assert.deepEqual(markerLines('hash', '0.3'), { begin: '# BEGIN complex-md (spec 0.3)', end: '# END complex-md (spec 0.3)' });
});

test('a region appended at the end comes out again byte for byte, with or without a final newline', () => {
  for (const original of ['# Rules\n\nNever rebase.\n', '# Rules\n\nNever rebase.', '', 'x\r\n\r\ny\r\n']) {
    const r = upsertRegion(original, CONTENT, { place: 'end', style: 'html', spec: '0.3' });
    assert.ok(r.text.startsWith(original), 'the original text stays in front');
    assert.ok(findRegion(r.text), 'the region is found');
    assert.equal(removeRegion(r.text, r).text, original, JSON.stringify(original));
  }
});

test('a region near the top goes after the title and comes out byte for byte', () => {
  const cases = [
    ['# AGENTS.md\n\nBody text.\n', '# AGENTS.md\n\n<!-- BEGIN complex-md (spec 0.3) -->\n'],
    ['# AGENTS.md\nBody text.\n', '# AGENTS.md\n\n<!-- BEGIN'],
    ['Body text.\n', '<!-- BEGIN'],
    ['---\nname: x\n---\n# Title\n\nBody\n', '---\nname: x\n---\n# Title\n\n<!-- BEGIN'],
    ['# Title', '# Title\n\n<!-- BEGIN'],
    ['# T\r\n\r\nBody\r\n', '# T\r\n\r\n<!-- BEGIN complex-md (spec 0.3) -->\r\n'],
  ];
  for (const [original, head] of cases) {
    const r = upsertRegion(original, CONTENT, { place: 'top', style: 'html', spec: '0.3' });
    assert.ok(r.text.startsWith(head), `${JSON.stringify(original)} gives ${JSON.stringify(r.text)}`);
    assert.equal(removeRegion(r.text, r).text, original);
  }
});

test('a region in a CRLF file uses CRLF, so the file does not end up with mixed line endings', () => {
  const original = '# Rules\r\n\r\nNever rebase.\r\n';
  const r = upsertRegion(original, CONTENT, { place: 'end', style: 'html', spec: '0.3' });
  assert.equal(eolOf(r.text), '\r\n');
  assert.ok(!/[^\r]\n/.test(r.text), 'every newline is CRLF');
});

test('a rewrite replaces only the marked text and leaves every other byte', () => {
  const r = upsertRegion('# Rules\n\nNever rebase.\n', CONTENT, { place: 'end', style: 'html', spec: '0.3' });
  const edited = `Top line of the user.\n${r.text}Bottom line of the user.\n`;
  const again = upsertRegion(edited, 'New text.\n', { place: 'end', style: 'html', spec: '0.3' });
  assert.equal(again.replaced, true);
  assert.ok(again.text.startsWith('Top line of the user.\n# Rules\n\nNever rebase.\n\n<!-- BEGIN complex-md (spec 0.3) -->\nNew text.\n'));
  assert.ok(again.text.endsWith('<!-- END complex-md (spec 0.3) -->\nBottom line of the user.\n'));
  assert.equal(upsertRegion(again.text, 'New text.\n', { place: 'end', style: 'html', spec: '0.3' }).text, again.text, 'the same content changes nothing');
});

test('a region from an older spec version is found and replaced in place', () => {
  const old = '# Rules\n\n<!-- BEGIN complex-md (spec 0.2) -->\nold\n<!-- END complex-md (spec 0.2) -->\n\nAfter.\n';
  const r = upsertRegion(old, 'new\n', { place: 'end', style: 'html', spec: '0.3' });
  assert.equal(r.text, '# Rules\n\n<!-- BEGIN complex-md (spec 0.3) -->\nnew\n<!-- END complex-md (spec 0.3) -->\n\nAfter.\n');
});

test('a begin marker without an end marker is reported and nothing is changed', () => {
  const broken = '# Rules\n\n<!-- BEGIN complex-md (spec 0.3) -->\nhalf\n';
  assert.equal(findRegion(broken).broken, true);
  const r = upsertRegion(broken, 'x\n', { place: 'end', style: 'html', spec: '0.3' });
  assert.equal(r.broken, true);
  assert.equal(r.text, broken);
});

test('removal keeps a separator the user has changed, and takes the region only', () => {
  const r = upsertRegion('A\n', CONTENT, { place: 'end', style: 'html', spec: '0.3' });
  const joined = r.text.replace('A\n\n', 'A\n');
  assert.equal(removeRegion(joined, r).text, 'A\n');
  const moved = `${r.text}more\n`;
  assert.equal(removeRegion(moved, r).text, 'A\nmore\n', 'text after the region stays');
});

test('the hash ignores line endings, so a CRLF checkout is not an edit', () => {
  assert.equal(normalizedHash('a\r\nb\r\n'), normalizedHash('a\nb\n'));
  assert.notEqual(normalizedHash('a\nb\n'), normalizedHash('a\nc\n'));
  assert.match(normalizedHash('x'), /^[0-9a-f]{64}$/);
});

test('separators recorded as LF are removed from a file a checkout turned to CRLF', () => {
  const r = upsertRegion('# Rules\n\nBody\n', CONTENT, { place: 'top', style: 'html', spec: '0.3' });
  const converted = r.text.replace(/\n/g, '\r\n');
  assert.equal(removeRegion(converted, r).text, '# Rules\r\n\r\nBody\r\n');
});
