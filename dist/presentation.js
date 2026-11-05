export const featureLabels = {
  wallet: 'Wallet & key custody', device: 'Device setup & grant',
  'server-list': 'Server discovery', favourites: 'Favourite servers', quality: 'Quality & reachability',
  session: 'Connect & disconnect', 'auto-connect': 'Auto-connect', status: 'Connection status',
  cost: 'Cost preview', 'top-up': 'Deposit top-up', settlement: 'Settlement & withdraw',
  activity: 'Activity & history', plans: 'Subscription plans', 'kill-switch': 'Kill switch',
  'restore-network': 'Restore network', dns: 'DNS controls', 'split-tunnel': 'Split tunnelling',
  'system-proxy': 'System proxy', settings: 'Settings', diagnostics: 'Diagnostics & logs',
  notifications: 'Notifications', tray: 'Tray / quick access', autostart: 'Start with OS',
  appearance: 'Theme & language', cli: 'CLI twin', 'app-info': 'App info & snapshot', 'node-test': 'In-app node test',
};

export const categoryIcons = {
  'network-safety': 'shield', connection: 'network', payments: 'wallet',
  'app-behaviour': 'sliders', appearance: 'palette', tools: 'terminal',
};

const paths = {
  shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  network: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v7a2 2 0 0 0 2 2H14M17.5 15V8a2 2 0 0 0-2-2H10"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2L5 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5"/><path d="M21 12h-5v5h5M17 14.5h.01"/>',
  sliders: '<path d="M5 3v5m0 4v9M12 3v11m0 4v3M19 3v2m0 4v12M2 8h6v4H2zM9 14h6v4H9zM16 5h6v4h-6z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.3-3.5 1.5 1.5 0 0 1 1-2.5H18a3 3 0 0 0 3-3 9 9 0 0 0-9-9Z"/><path d="M7.5 9h.01M11 6.5h.01M15.5 8h.01M6.5 13h.01"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  monitor: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8m-4-5v5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  book: '<path d="M4 4h6a2 2 0 0 1 2 2v15a3 3 0 0 0-3-2H4V4Zm16 0h-6a2 2 0 0 0-2 2v15a3 3 0 0 1 3-2h5V4Z"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-15-2L3 8m0-5v5h5M4 17a9 9 0 0 0 15 2l2-3m0 5v-5h-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
};

export function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', '1.6');
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('aria-hidden', 'true');
  node.classList.add('ui-icon');
  // Only the fixed path definitions above are inserted here.
  node.innerHTML = paths[name] || paths.layers;
  return node;
}

for (const target of document.querySelectorAll('[data-icon]')) target.prepend(icon(target.dataset.icon));
