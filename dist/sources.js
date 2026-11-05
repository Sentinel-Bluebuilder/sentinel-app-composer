import { loadGeneration, readData } from './data-source.js';

const $ = selector => document.querySelector(selector);
const logos = { windows: './logos/windows.svg', linux: './logos/linux.png', macos: './logos/apple.svg', android: './logos/android.svg' };
const date = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unavailable';

function link(text, url) {
  const element = document.createElement('a');
  element.textContent = text;
  element.href = url;
  element.target = '_blank';
  element.rel = 'noopener noreferrer';
  return element;
}

function revisionRow(label, revision, source) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  term.textContent = label;
  const value = document.createElement('dd');
  if (revision) value.append(link(revision.slice(0, 8), `${source.url}/commit/${revision}`));
  else value.textContent = 'Pending';
  row.append(term, value);
  return row;
}

function sourceCard(source) {
  const card = document.createElement('article');
  card.className = 'source-card';
  const header = document.createElement('header');
  const title = document.createElement('h3');
  if (source.os) {
    const icon = document.createElement('img');
    icon.src = source.os === 'macos' && document.documentElement.dataset.theme === 'light' ? './logos/apple-light.svg' : logos[source.os];
    icon.alt = '';
    icon.width = 28;
    icon.height = 28;
    icon.dataset.os = source.os;
    title.append(icon);
  }
  title.append(link(source.name, source.url));
  const badge = document.createElement('span');
  badge.className = `sync-badge ${source.syncStatus}`;
  badge.textContent = { imported: 'Code synced', indexed: 'Indexed', failed: 'Sync failed' }[source.syncStatus] || 'Pending';
  header.append(title, badge);
  const subtitle = document.createElement('p');
  subtitle.className = 'source-repository';
  subtitle.textContent = `${source.repository} · ${source.branch}${source.private ? ' · Private' : ''}`;
  const revisions = document.createElement('dl');
  revisions.className = 'source-revisions';
  revisions.append(revisionRow('GitHub', source.revision, source));
  revisions.append(revisionRow(source.kind === 'app' ? 'Imported code' : 'Indexed source', source.kind === 'app' ? source.importedRevision : source.indexedRevision, source));
  revisions.append(revisionRow('Documentation reviewed', source.reviewedRevision, source));
  const status = document.createElement('p');
  status.className = `source-review ${source.reviewStatus}`;
  status.textContent = source.reviewStatus === 'current' ? 'Documentation reviewed for this revision' : 'Documentation review required';
  const pushed = document.createElement('p');
  pushed.className = 'source-date';
  pushed.textContent = `Last push ${date(source.pushedAt)}`;
  card.append(header, subtitle, revisions, status, pushed);

  if (source.documents?.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `Source documents (${source.documents.length})`;
    const list = document.createElement('ul');
    list.className = 'source-documents';
    for (const document of source.documents) {
      const item = window.document.createElement('li');
      item.append(link(document.path, document.url));
      list.append(item);
    }
    details.append(summary, list);
    card.append(details);
  }
  if (source.changes && !source.changes.initial) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const count = source.changes.added + source.changes.changed + source.changes.removed;
    summary.textContent = `${count} file changes since previous sync`;
    const text = document.createElement('p');
    text.textContent = `${source.changes.added} added · ${source.changes.changed} changed · ${source.changes.removed} removed`;
    details.append(summary, text);
    if (source.previousRevision) details.append(link('Compare revisions', `${source.url}/compare/${source.previousRevision}...${source.revision}`));
    card.append(details);
  }
  return card;
}

function renderEvidence(catalogue) {
  const cells = Object.values(catalogue.matrix.features).flatMap(feature => Object.values(feature.cells));
  const current = cells.filter(cell => cell.verification === 'current').length;
  const historical = cells.filter(cell => cell.verification === 'historical').length;
  $('#evidence-status').textContent = `${current} revision-matched results · ${historical} historical results · ${cells.length - current - historical} without recorded evidence. Knowledge baseline ${catalogue.provenance.knowledgeBaselineDate}.`;
  $('#evidence-platforms').replaceChildren();
  for (const platform of catalogue.taxonomy.platformVariants) {
    const records = Object.values(catalogue.matrix.features).map(feature => feature.cells[platform.id]);
    const verified = records.filter(cell => cell?.verification === 'current').length;
    const historical = records.filter(cell => cell?.verification === 'historical').length;
    const row = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = platform.id;
    const value = document.createElement('span');
    value.textContent = `${verified} current · ${historical} historical`;
    row.append(name, value);
    $('#evidence-platforms').append(row);
  }
}

async function refresh() {
  $('#refresh-sources').disabled = true;
  try {
    // Status remains readable when a first import has failed and no catalogue exists yet.
    const status = await readData('sync-status.json');
    const age = Date.now() - new Date(status.checkedAt).getTime();
    const overdue = age > Math.max(120, status.intervalMinutes * 3) * 60000;
    const failed = status.status !== 'synced';
    $('#sync-alert').hidden = !failed && !overdue;
    $('#sync-alert').textContent = failed
      ? 'The latest sync failed. The composer uses the last validated catalogue. Open Sync runs for details.'
      : overdue ? 'The scheduled sync is overdue. These revisions reflect the last successful check.' : '';
    $('#sync-time').textContent = `Checked ${date(status.checkedAt)} · Scheduled every ${status.intervalMinutes} minutes`;
    $('#sources-count').textContent = `${status.sources.filter(source => source.revision).length}/${status.sources.length}`;
    $('#imports-count').textContent = `${status.sources.filter(source => source.importedRevision === source.revision && source.revision && source.kind === 'app').length}/4`;
    $('#reviews-count').textContent = status.sources.filter(source => source.reviewStatus !== 'current').length;
    $('#workflow-link').href = status.runUrl || status.workflowUrl;
    $('#app-sources').replaceChildren(...status.sources.filter(source => source.kind === 'app').map(sourceCard));
    $('#support-sources').replaceChildren(...status.sources.filter(source => source.kind !== 'app').map(sourceCard));
    try {
      const { catalogue, snapshotUrl } = await loadGeneration();
      $('#snapshot-link').href = snapshotUrl;
      renderEvidence(catalogue);
    } catch {
      $('#evidence-status').textContent = 'A validated evidence catalogue is currently unavailable.';
      $('#evidence-platforms').replaceChildren();
    }
  } catch {
    $('#sync-alert').hidden = false;
    $('#sync-alert').textContent = 'Source status could not be loaded. Refresh to try again.';
    $('#sync-time').textContent = 'Unable to check source revisions';
  } finally {
    $('#refresh-sources').disabled = false;
  }
}
$('#refresh-sources').addEventListener('click', refresh);
document.addEventListener('themechange', () => {
  for (const image of document.querySelectorAll('img[data-os="macos"]')) {
    image.src = document.documentElement.dataset.theme === 'light' ? './logos/apple-light.svg' : './logos/apple.svg';
  }
});
refresh();
