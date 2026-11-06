import { loadGeneration } from './data-source.js';
import './presentation.js';

const dimensions = [
  ['Knowledge & feature model', 15, 15],
  ['Source sync & provenance', 15, 15],
  ['Contributor ingestion', 10, 10],
  ['Deterministic composition', 10, 10],
  ['Current automated evidence', 0, 15],
  ['Live-network coverage', 3, 10],
  ['Security & review', 0, 10],
  ['Release engineering', 3, 10],
  ['Onboarding & operations', 5, 5],
];

const container = document.querySelector('#system-dimensions');
for (const [label, score, maximum] of dimensions) {
  const card = document.createElement('article');
  card.className = 'dimension-card';
  const header = document.createElement('header');
  const title = document.createElement('h3');
  title.textContent = label;
  const value = document.createElement('strong');
  value.textContent = `${score}/${maximum}`;
  header.append(title, value);
  const track = document.createElement('div');
  track.className = 'dimension-track';
  const fill = document.createElement('span');
  fill.style.width = `${(score / maximum) * 100}%`;
  track.append(fill);
  card.append(header, track);
  container.append(card);
}

try {
  const { catalogue, status } = await loadGeneration();
  const implementations = catalogue.library?.implementations || [];
  const reports = implementations.flatMap(item => item.reports || []);
  const cells = Object.values(catalogue.matrix.features).flatMap(feature => Object.values(feature.cells));
  const reviews = implementations.flatMap(item => item.contract?.reviews || []);
  const metrics = {
    'metric-implementations': implementations.length,
    'metric-current-reports': reports.filter(report => report.verification === 'current').length,
    'metric-current-cells': cells.filter(cell => cell.verification === 'current').length,
    'metric-historical-cells': cells.filter(cell => cell.verification === 'historical').length,
    'metric-missing-cells': cells.filter(cell => cell.verification === 'missing').length,
    'metric-reviews': reviews.length,
  };
  for (const [id, value] of Object.entries(metrics)) document.querySelector(`#${id}`).textContent = value;
  const checked = Number.isFinite(Date.parse(status.checkedAt)) ? new Date(status.checkedAt).toLocaleString() : 'time unavailable';
  document.querySelector('#evidence-revision').textContent = `Catalogue ${catalogue.revision.slice(0, 12)} · synchronized ${checked}`;
} catch {
  document.querySelector('#evidence-revision').textContent = 'Current catalogue metrics are unavailable.';
}
