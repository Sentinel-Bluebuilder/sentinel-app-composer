import { loadGeneration, syncOverdue } from './data-source.js';
import { featureLabels, categoryIcons, icon } from './presentation.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
let selectedFeature = params.get('feature') || 'kill-switch';
let catalogue;
let implementations = [];
const names = { windows: 'Windows', linux: 'Linux', macos: 'macOS', android: 'Android' };
const logos = { windows: './logos/windows.svg', linux: './logos/linux.png', macos: './logos/apple.svg', android: './logos/android.svg' };
const stateNames = { passed: 'Passed', failed: 'Failed', incomplete: 'Incomplete', historical: 'Historical', unverified: 'Unverified', 'no-report': 'No report' };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, url) {
  const node = element('a', text);
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}
function badge(state) { return element('span', stateNames[state] || state, `testing-badge ${state}`); }
function section(title) {
  const node = element('section', undefined, 'implementation-section');
  node.append(element('h4', title));
  return node;
}
function details(title) {
  const node = element('details', undefined, 'implementation-details');
  node.append(element('summary', title));
  return node;
}

function renderAttribution(implementation) {
  const node = section('Creators & contributors');
  if (implementation.creators.length) {
    for (const creator of implementation.creators) {
      const row = element('div', undefined, 'creator-row');
      row.append(link(`@${creator.github}`, creator.url), link('Creator declaration', creator.declarationUrl));
      node.append(row);
    }
  }
  if (implementation.attribution.contributors.length) {
    const contributors = element('div', undefined, 'contributor-list');
    for (const contributor of implementation.attribution.contributors) {
      const account = link(`@${contributor.github}`, contributor.url);
      account.prepend(icon('user'));
      contributors.append(account);
    }
    node.append(contributors, element('p', implementation.creators.length ? 'GitHub contributors to mapped files' : 'GitHub contributors · Creator declaration pending', 'scope-note'));
  } else node.append(element('p', implementation.creators.length ? 'Code contributor attribution unavailable' : 'Creator and contributor attribution pending', 'scope-note'));
  const history = details('Attribution sources');
  const attribution = implementation.attribution;
  if (attribution.observedRevision) history.append(link(`History indexed at ${attribution.observedRevision.slice(0, 8)}`, `${implementation.repository}/commit/${attribution.observedRevision}`));
  if (attribution.status === 'partial') history.append(element('p', 'Some file histories are unavailable.'));
  for (const contributor of attribution.contributors) {
    history.append(element('p', `${contributor.github} · ${contributor.files} mapped files`), link('View a contributing commit', contributor.exampleCommit));
  }
  for (const file of attribution.files || []) {
    const result = file.status === 'indexed' ? `${file.commits} commit${file.commits === 1 ? '' : 's'}` : 'History unavailable';
    history.append(element('p', `${file.path} · ${result}`, 'scope-note'));
    if (file.unlinkedCommits) history.append(element('p', `${file.unlinkedCommits} commits have no linked GitHub account.`));
    if (file.truncated) history.append(element('p', 'History covers the most recent 500 commits for this file.'));
  }
  history.append(element('p', 'Creator declarations and commit attribution are recorded separately.', 'scope-note'));
  node.append(history);
  return node;
}

function renderTesting(implementation) {
  const node = section('Testing');
  const list = element('dl', undefined, 'implementation-testing');
  for (const level of implementation.testing) {
    const row = element('div');
    const term = element('dt', level.name);
    const value = element('dd');
    value.append(badge(level.state));
    for (const scope of level.scopes) value.append(element('small', `${scope.platformIds.join(', ')}${scope.protocols.length ? ` · ${scope.protocols.join(', ')}` : ''} · ${stateNames[scope.result] || scope.result}`, 'test-scope'));
    row.append(term, value);
    list.append(row);
  }
  node.append(list);
  const integrity = element('div', undefined, 'implementation-integrity');
  const integrityLabel = element('span', 'Source integrity');
  integrityLabel.prepend(icon('shield'));
  integrity.append(integrityLabel, badge(implementation.integrity.status));
  node.append(integrity);
  if (implementation.integrity.platforms.length) node.append(element('p', implementation.integrity.platforms.join(' · '), 'scope-note'));
  if (implementation.integrity.url) node.append(link('View source validation', implementation.integrity.url));
  if (implementation.reports.length) {
    const reports = details(`Test reports (${implementation.reports.length})`);
    for (const report of implementation.reports) {
      const record = element('article', undefined, 'implementation-report');
      record.append(element('strong', `${report.level} · ${report.result} · ${report.verification}`));
      record.append(element('p', report.summary));
      record.append(element('p', `Registered scope · ${report.platformIds.join(', ')}${report.protocols.length ? ` · ${report.protocols.join(', ')}` : ''}`, 'scope-note'));
      record.append(element('p', `${report.workflowPath} · ${report.jobName}`, 'scope-note'));
      for (const [sourceId, revision] of Object.entries(report.revisions)) record.append(element('p', `${sourceId} · ${revision.slice(0, 8)}`, 'scope-note'));
      if (report.testedAt) record.append(element('p', new Date(report.testedAt).toLocaleString(), 'scope-note'));
      record.append(link('Open GitHub test run', report.url));
      reports.append(record);
    }
    node.append(reports);
  }
  const earlier = implementation.historicalEvidence;
  if (earlier.length) {
    const history = details(`Historical evidence (${earlier.length})`);
    for (const record of earlier) {
      const item = element('article', undefined, 'implementation-report');
      item.append(element('strong', `${record.platformId} · ${record.state}`), element('p', record.evidence));
      if (record.evidenceUrl || record.sourceUrl) item.append(link(record.evidenceUrl ? 'View evidence' : 'Browse cited source', record.evidenceUrl || record.sourceUrl));
      history.append(item);
    }
    node.append(history);
  }
  return node;
}

function implementationCard(implementation) {
  const card = element('article', undefined, 'implementation-card');
  const header = element('header');
  const mark = element('span', undefined, 'implementation-mark');
  if (logos[implementation.os]) {
    const image = element('img');
    image.src = implementation.os === 'macos' && document.documentElement.dataset.theme === 'light' ? './logos/apple-light.svg' : logos[implementation.os];
    image.dataset.os = implementation.os;
    image.alt = '';
    image.width = 28;
    image.height = 28;
    mark.append(image);
  } else mark.append(icon('code'));
  const title = element('div');
  title.append(element('h3', implementation.reference ? names[implementation.os] || implementation.title : implementation.title));
  title.append(element('p', implementation.reference ? 'Reference integration' : 'Independent implementation', 'implementation-kind'));
  header.append(mark, title);
  card.append(header);
  const revision = element('div', undefined, 'implementation-revision');
  revision.append(link(new URL(implementation.repository).pathname.split('/').pop(), implementation.repository),
    link(implementation.revision.slice(0, 8), `${implementation.repository}/commit/${implementation.revision}`));
  card.append(revision, renderAttribution(implementation), renderTesting(implementation));
  const code = details(`Code & scope (${implementation.files.length} mapped files)`);
  const owner = element('p', undefined, 'implementation-owner');
  owner.append('Repository owner ', link(`@${implementation.repositoryOwner}`, `https://github.com/${implementation.repositoryOwner}`));
  code.append(owner);
  code.append(element('p', `${implementation.kind === 'client-integration' ? 'Client integration' : 'Component'} · ${implementation.platforms.join(', ')}`, 'scope-note'));
  if (!implementation.files.length) code.append(element('p', 'Code mapping needs review.'));
  const files = element('ul');
  for (const file of implementation.files) {
    const item = element('li');
    item.append(link(file.path, file.url));
    files.append(item);
  }
  code.append(files);
  for (const dependency of implementation.dependencies) {
    code.append(element('p', `Dependency · ${dependency.sourceId}`), link(dependency.revision.slice(0, 8), `${dependency.repository}/commit/${dependency.revision}`));
  }
  code.append(element('p', `Implementation ID · ${implementation.id}`, 'scope-note'));
  card.append(code);
  return card;
}

function render() {
  const focusedFeature = document.activeElement?.dataset.feature;
  const query = $('#library-search').value.trim().toLowerCase();
  const os = $('#library-platform').value;
  const platformOs = new Map(catalogue.taxonomy.platformVariants.map(platform => [platform.id, platform.os]));
  const featureNames = new Map(catalogue.taxonomy.featureCategories.flatMap(group => group.features.map(feature => [feature.id, featureLabels[feature.id] || feature.name])));
  const visible = implementations.filter(implementation => {
    const text = [implementation.id, featureNames.get(implementation.featureId), implementation.title, implementation.repositoryOwner,
      ...implementation.creators.map(creator => creator.github), ...implementation.attribution.contributors.map(contributor => contributor.github)].join(' ').toLowerCase();
    return (!os || implementation.platforms.some(platform => platformOs.get(platform) === os)) && (!query || text.includes(query));
  });
  const available = new Set(visible.map(implementation => implementation.featureId));
  if (!available.has(selectedFeature)) selectedFeature = catalogue.taxonomy.featureCategories.flatMap(group => group.features).find(feature => available.has(feature.id))?.id || '';
  const navigation = $('#library-features');
  navigation.replaceChildren();
  const featureSelect = $('#library-feature-select');
  featureSelect.replaceChildren();
  for (const category of catalogue.taxonomy.featureCategories) {
    const features = category.features.filter(feature => available.has(feature.id));
    if (!features.length) continue;
    const group = element('div', undefined, 'library-feature-group');
    const optionGroup = element('optgroup');
    optionGroup.label = category.name;
    const heading = element('h2', category.name);
    heading.prepend(icon(categoryIcons[category.id]));
    group.append(heading);
    for (const feature of features) {
      const button = element('button');
      button.type = 'button';
      button.dataset.feature = feature.id;
      button.className = selectedFeature === feature.id ? 'active' : '';
      button.setAttribute('aria-pressed', String(selectedFeature === feature.id));
      button.title = feature.name;
      button.append(element('span', featureNames.get(feature.id)), element('small', String(visible.filter(item => item.featureId === feature.id).length)));
      button.addEventListener('click', () => { selectedFeature = feature.id; render(); });
      group.append(button);
      const option = element('option', featureNames.get(feature.id));
      option.value = feature.id;
      option.selected = selectedFeature === feature.id;
      optionGroup.append(option);
    }
    navigation.append(group);
    featureSelect.append(optionGroup);
  }
  featureSelect.disabled = available.size === 0;
  const selected = visible.filter(implementation => implementation.featureId === selectedFeature);
  $('#selected-feature').textContent = featureNames.get(selectedFeature) || 'No matching features';
  $('#implementation-count').textContent = `${selected.length} implementation${selected.length === 1 ? '' : 's'}`;
  $('#implementation-cards').replaceChildren(...selected.map(implementationCard));
  $('#library-empty').hidden = selected.length > 0;
  const url = new URL(location.href);
  if (selectedFeature) url.searchParams.set('feature', selectedFeature); else url.searchParams.delete('feature');
  if (os) url.searchParams.set('platform', os); else url.searchParams.delete('platform');
  if (query) url.searchParams.set('q', $('#library-search').value.trim()); else url.searchParams.delete('q');
  history.replaceState(null, '', url);
  if (focusedFeature) [...navigation.querySelectorAll('button')].find(button => button.dataset.feature === focusedFeature)?.focus({ preventScroll: true });
}

async function init() {
  try {
    const generation = await loadGeneration();
    catalogue = generation.catalogue;
    if (!catalogue.library) throw new Error('Implementation registry has not been published');
    implementations = catalogue.library.implementations;
    const featureCount = new Set(implementations.map(implementation => implementation.featureId)).size;
    $('#library-count').textContent = `${featureCount} features · ${implementations.length} implementations`;
    const platform = params.get('platform');
    if (names[platform]) $('#library-platform').value = platform;
    $('#library-search').value = params.get('q') || '';
    $('#library-search').addEventListener('input', render);
    $('#library-platform').addEventListener('change', render);
    $('#library-feature-select').addEventListener('change', event => { selectedFeature = event.target.value; render(); });
    if (generation.status.status !== 'synced') {
      $('#library-alert').hidden = false;
      $('#library-alert').textContent = 'The latest synchronization failed. Showing the last validated implementation registry.';
    } else if (syncOverdue(generation.status)) {
      $('#library-alert').hidden = false;
      $('#library-alert').textContent = 'Source synchronization is overdue. Check Sources for the last validated revisions.';
    }
    render();
  } catch {
    $('#library-count').textContent = 'Implementation records are unavailable';
    $('#library-alert').hidden = false;
    $('#library-alert').textContent = 'Check Sources for synchronization status, then reload to try again.';
  }
}
document.addEventListener('themechange', () => {
  for (const image of document.querySelectorAll('img[data-os="macos"]')) image.src = document.documentElement.dataset.theme === 'light' ? './logos/apple-light.svg' : './logos/apple.svg';
});
init();
