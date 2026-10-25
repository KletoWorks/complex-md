// The merge request note: one Markdown comment that names the hotspots
// and load bearing files a change touches and the co-change partners it
// leaves unchanged. The format is the pull request comment of
// KletoWorks/complex-md-action, worded for a GitLab merge request. The
// GitLab CI template in ci/gitlab/ posts it; this module only renders it
// and makes no request.

/* The first line. The CI job finds its own note again by this line. */
export const NOTE_MARKER = '<!-- complex-md:merge-request-note -->';
export const PARTNERS_SHOWN = 3;
export const PARTNER_GROUPS_SHOWN = 20;
/* GitLab accepts a note body up to 1,000,000 characters. The action cuts at
   60,000 for GitHub, and the same cut keeps a note readable. */
export const MAX_BODY = 60000;

/* A path as a Markdown code span. Control characters and line breaks
   become spaces, a pipe is escaped so it cannot end a table cell, and a
   backtick in the path gets a longer fence. */
export function code(s) {
  const clean = String(s).replace(/[\u0000-\u001f\u007f]+/g, (m) => (/[\n\r\t]/.test(m) ? ' ' : '')).replace(/\|/g, '\\|');
  if (!clean.includes('`')) return '`' + clean + '`';
  return '`` ' + clean + ' ``';
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const short = (sha) => (sha ? String(sha).slice(0, 7) : 'unknown');
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

/* The findings for one change. touched holds every path the diff names,
   a renamed file under both names. hotspots and loadBearing keep the
   map's order, which is rank order. partners holds each co-change pair
   with exactly one side touched, strongest pair first. */
export function noteFindings(map, touched) {
  const set = new Set(touched);
  const pick = (rows) => rows
    .filter((r) => r && set.has(r.path))
    .map((r) => ({ path: r.path, row: r, directive: map.directive(r.path) }));
  const hotspots = pick(map.hotspots || []);
  const loadBearing = pick(map.load_bearing || []);
  const partners = [];
  for (const pair of map.co_change || []) {
    const [a, b] = pair?.files || [];
    if (typeof a !== 'string' || typeof b !== 'string') continue;
    const hasA = set.has(a);
    if (hasA === set.has(b)) continue;
    partners.push({
      changed: hasA ? a : b,
      partner: hasA ? b : a,
      count: Number(pair.count) || 0,
      coupling: Number.isFinite(Number(pair.coupling)) && pair.coupling !== null && pair.coupling !== undefined ? Number(pair.coupling) : null,
    });
  }
  partners.sort((x, y) => y.count - x.count);
  return { hotspots, loadBearing, partners, clean: !hotspots.length && !loadBearing.length && !partners.length };
}

/* Where the map came from. ref is the name given to --map-ref and sha its
   commit; with no ref the map is the working tree copy. */
function footer({ ref = null, sha = null, front = {}, behind } = {}) {
  const at = ref ? ` at ${code(ref)} ${code(short(sha))}` : ' in the working tree';
  let made = '';
  if (front.generated || front.commit) {
    made = ` The map was generated${front.generated ? ` ${front.generated}` : ''}`;
    if (front.commit) {
      made += ` at ${code(short(front.commit))}`;
      if (ref) {
        if (behind === null || behind === undefined) made += `, a commit not in the history of ${code(ref)}`;
        else if (behind === 0) made += `, current with ${code(ref)}`;
        else made += `, ${plural(behind, 'commit', 'commits')} behind ${code(ref)}`;
      }
    }
    made += '.';
  }
  return `<sub>Read from ${code('COMPLEX.md')}${at}.${made} complex-md runs no code from this merge request.</sub>`;
}

export function renderNote(f, ctx = {}) {
  const counts = [];
  if (f.hotspots.length) counts.push(`${plural(f.hotspots.length, 'hotspot', 'hotspots')} touched`);
  if (f.loadBearing.length) counts.push(`${plural(f.loadBearing.length, 'load bearing file', 'load bearing files')} touched`);
  if (f.partners.length) counts.push(`${plural(f.partners.length, 'co-change partner', 'co-change partners')} not in this merge request`);
  const out = [NOTE_MARKER, `**COMPLEX.md**: ${counts.join(', ')}.`, ''];

  if (f.hotspots.length) {
    out.push('| Hotspot | Score | Churn | Fixes | Fan in | Tests |', '|---|--:|--:|--:|--:|--:|');
    for (const h of f.hotspots) {
      const r = h.row;
      out.push(`| ${code(h.path)} | ${r.score ?? ''} | ${r.churn ?? ''} | ${r.fixes ?? ''} | ${r.fan_in ?? ''} | ${r.tests ?? ''} |`);
    }
    out.push('');
  }
  if (f.loadBearing.length) {
    out.push('| Load bearing | Fan in | Tests |', '|---|--:|--:|');
    for (const h of f.loadBearing) out.push(`| ${code(h.path)} | ${h.row.fan_in ?? ''} | ${h.row.tests ?? ''} |`);
    out.push('');
  }
  const directives = [...f.hotspots, ...f.loadBearing].filter((h) => h.directive);
  for (const h of directives) out.push(`- ${code(h.path)}: ${oneLine(h.directive)}`);
  if (directives.length) out.push('');

  if (f.partners.length) {
    out.push('**Co-change partners not in this merge request**', '');
    const groups = new Map();
    for (const p of f.partners) {
      if (!groups.has(p.changed)) groups.set(p.changed, []);
      groups.get(p.changed).push(p);
    }
    const shownGroups = [...groups].slice(0, PARTNER_GROUPS_SHOWN);
    for (const [changed, list] of shownGroups) {
      const shown = list.slice(0, PARTNERS_SHOWN).map((p) => `${code(p.partner)} (${p.count} commits together${p.coupling === null ? '' : `, ${p.coupling} percent`})`);
      const more = list.length > PARTNERS_SHOWN ? `, and ${list.length - PARTNERS_SHOWN} more in COMPLEX.md` : '';
      out.push(`- ${code(changed)} changed. Unchanged: ${shown.join(', ')}${more}. Say whether each needs a change.`);
    }
    if (groups.size > shownGroups.length) {
      out.push(`- and ${groups.size - shownGroups.length} more changed files with a partner left unchanged.`);
    }
    out.push('');
  }
  out.push(footer(ctx));
  let body = out.join('\n');
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 40) + '\n\n(note cut at the size limit)';
  return body;
}

/* The note for a change that touches nothing. It leaves out the map's
   lag, so it does not change each time the target branch moves. */
export function renderNoteCleared({ ref = null, sha = null } = {}) {
  return [NOTE_MARKER, '**COMPLEX.md**: this merge request no longer touches a hotspot, a load bearing file or a co-change pair.', '', footer({ ref, sha })].join('\n');
}
