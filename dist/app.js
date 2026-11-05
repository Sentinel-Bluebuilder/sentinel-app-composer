import { loadGeneration } from './data-source.js';

const state = {
  taxonomy: null,
  matrix: null,
  rules: null,
  appTypes: new Set(["free"]),
  platform: "windows-11-x64",
  protocols: new Set(["wireguard"]),
  optionalFeatures: new Set(["kill-switch"]),
  query: "",
  provenance: null,
  catalogueRevision: null,
  snapshotUrl: null,
  syncStatus: null,
};

const appTypeLabels = {
  free: "Free",
  "crypto-payments": "Crypto Payments",
  "fiat-payments": "Fiat Payments",
};

const osMeta = {
  windows: { label: "Windows", logo: "windows.svg" },
  linux: { label: "Linux", logo: "linux.png" },
  macos: { label: "macOS", logo: "apple.svg" },
  android: { label: "Android", logo: "android.svg" },
};

const platformLabels = {
  "windows-11-x64": "Windows 11 · x64",
  "windows-11-arm64": "Windows 11 · ARM64",
  "windows-11-home-laptop": "Windows 11 Home · daily-use laptop",
  "ubuntu-22.04": "Ubuntu 22.04 · x64",
  "ubuntu-24.04": "Ubuntu 24.04 · x64",
  "debian-12": "Debian 12 · x64",
  "fedora-44": "Fedora 44 · x64",
  "rocky-9": "Rocky Linux 9",
  "linux-arm64": "Linux · ARM64",
  "macos-intel": "macOS · Intel",
  "macos-apple-silicon": "macOS · Apple silicon",
  "android-emulator": "Android · emulator",
  "android-device": "Android · physical device",
};

const protocolMeta = {
  wireguard: { label: "WireGuard", logo: "wireguard.png" },
  amneziawg: { label: "AmneziaWG", logo: "amneziawg-on-dark.svg" },
  openvpn: { label: "OpenVPN", logo: "openvpn-on-dark.svg" },
  v2ray: { label: "V2Ray", logo: "v2ray.png" },
  xray: { label: "Xray", logo: "xray-on-dark.svg" },
  hysteria2: { label: "Hysteria2", logo: "hysteria2-on-dark.svg" },
};

const distributionLogos = {
  ubuntu: "ubuntu.svg",
  debian: "debian.svg",
  fedora: "fedora.ico",
  rocky: "rocky.svg",
};

const featureShort = {
  wallet: "Wallet & key custody",
  device: "Device setup & grant",
  "server-list": "Server discovery",
  favourites: "Favourite servers",
  quality: "Quality & reachability",
  session: "Connect & disconnect",
  "auto-connect": "Auto-connect",
  status: "Connection status",
  cost: "Cost preview",
  "top-up": "Deposit top-up",
  settlement: "Settlement & withdraw",
  activity: "Activity & history",
  plans: "Subscription plans",
  "kill-switch": "Kill switch",
  "restore-network": "Restore network",
  dns: "DNS controls",
  "split-tunnel": "Split tunnelling",
  "system-proxy": "System proxy",
  settings: "Settings",
  diagnostics: "Diagnostics & logs",
  notifications: "Notifications",
  tray: "Tray / quick access",
  autostart: "Start with OS",
  appearance: "Theme & language",
  cli: "CLI twin",
  "app-info": "App info & snapshot",
  "node-test": "In-app node test",
};

const $ = (selector) => document.querySelector(selector);

function themedLogo(file) {
  const original = file.replace("-on-light.svg", "-on-dark.svg")
    .replace("apple-light.svg", "apple.svg")
    .replace("ubuntu-light.svg", "ubuntu.svg");
  if (document.documentElement.dataset.theme !== "light") return original;
  return original.replace("-on-dark.svg", "-on-light.svg")
    .replace("apple.svg", "apple-light.svg")
    .replace("ubuntu.svg", "ubuntu-light.svg");
}

function currentPlatformMeta() {
  return state.taxonomy.platformVariants.find((item) => item.id === state.platform);
}

function currentOs() {
  return currentPlatformMeta()?.os || "windows";
}

function platformLogo() {
  const distribution = state.platform.split("-")[0];
  return themedLogo(distributionLogos[distribution] || osMeta[currentOs()].logo);
}

function runtimeFor(os) {
  if (os === "android") {
    return {
      logo: "android.svg",
      name: "Android native bridge",
      manifest: "Android bridge + Web UI",
      version: "VpnService + web preload",
    };
  }
  return {
    logo: "electron.svg",
    name: "Electron desktop shell",
    manifest: "Electron desktop",
    version: "TypeScript + React",
  };
}

function allFeatures() {
  return state.taxonomy.featureCategories.flatMap((category) => category.features.map((feature) => ({ ...feature, category })));
}

function selectedFeatureIds() {
  return [...new Set([...state.rules.core, ...state.optionalFeatures])];
}

function featureById(id) {
  return allFeatures().find((feature) => feature.id === id);
}

function proofFor(featureId) {
  const cell = state.matrix.features?.[featureId]?.cells?.[state.platform];
  if (!cell) return { state: "untested", evidence: null };
  return { ...cell, recordedState: cell.state, state: cell.verification === "historical" ? "historical" : cell.state };
}

function unsupportedReason(featureId) {
  return state.rules.notOn?.[currentOs()]?.[featureId] || null;
}

function requiredBy(featureId) {
  return [...state.optionalFeatures].filter((selected) => state.rules.requires?.[selected]?.features?.includes(featureId));
}

function addFeature(id, announce = true) {
  if (unsupportedReason(id)) return;
  state.optionalFeatures.add(id);
  const requirement = state.rules.requires?.[id];
  if (requirement) {
    requirement.features.forEach((dependency) => state.optionalFeatures.add(dependency));
    if (announce) showToast(`Added ${featureShort[id] || id} and its required module${requirement.features.length > 1 ? "s" : ""}.`);
  }
}

function toggleFeature(id) {
  if (state.rules.core.includes(id) || unsupportedReason(id)) return;
  if (state.optionalFeatures.has(id)) {
    const parents = requiredBy(id);
    if (parents.length) {
      showToast(`${featureShort[id]} is required by ${parents.map((parent) => featureShort[parent] || parent).join(", ")}.`);
      return;
    }
    state.optionalFeatures.delete(id);
  } else {
    addFeature(id);
  }
  render();
}

function setPlatform(platformId) {
  state.platform = platformId;
  const os = currentOs();
  const blocked = state.rules.notOn?.[os] || {};
  const removed = [...state.optionalFeatures].filter((id) => blocked[id]);
  removed.forEach((id) => state.optionalFeatures.delete(id));
  if (removed.length) showToast(`Removed ${removed.length} feature${removed.length > 1 ? "s" : ""} not available on ${osMeta[os].label}.`);
  render();
}

function renderAppTypes() {
  const summary = $("#manifest-app-types");
  summary.replaceChildren();
  document.querySelectorAll('#app-type-options input').forEach((input) => {
    const selected = state.appTypes.has(input.value);
    input.checked = selected;
    const card = input.closest("label");
    card.classList.toggle("selected", selected);
    if (selected) {
      const chip = document.createElement("span");
      chip.append(card.querySelector("svg").cloneNode(true), appTypeLabels[input.value]);
      summary.append(chip);
    }
  });
}

function renderOsOptions() {
  const container = $("#os-options");
  container.replaceChildren();
  const selectedOs = currentOs();
  Object.entries(osMeta).forEach(([id, meta]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-card ${id === selectedOs ? "selected" : ""}`;
    button.setAttribute("aria-pressed", String(id === selectedOs));
    button.innerHTML = `<span class="card-symbol os-mark"><img src="./logos/${themedLogo(meta.logo)}" alt="" width="28" height="28" /></span><strong>${meta.label}</strong>`;
    button.addEventListener("click", () => {
      const first = state.taxonomy.platformVariants.find((platform) => platform.os === id);
      if (first) setPlatform(first.id);
    });
    container.append(button);
  });

  const select = $("#variant-select");
  select.replaceChildren();
  state.taxonomy.platformVariants.filter((platform) => platform.os === selectedOs).forEach((platform) => {
    const option = document.createElement("option");
    option.value = platform.id;
    option.textContent = platformLabels[platform.id] || platform.id;
    option.selected = platform.id === state.platform;
    select.append(option);
  });
  select.onchange = (event) => setPlatform(event.target.value);
  $("#variant-logo").src = `./logos/${platformLogo()}`;

  const platform = currentPlatformMeta();
  const note = $("#platform-note");
  note.hidden = !platform?.note;
  note.textContent = platform?.note || "";
}

function renderRuntime() {
  const runtime = runtimeFor(currentOs());
  $("#runtime-symbol").innerHTML = `<img src="./logos/${runtime.logo}" alt="" width="36" height="36" />`;
  $("#runtime-name").textContent = currentOs() === "android" ? "Android bridge" : "Electron";
  $("#runtime-version").textContent = runtime.version;
}

function renderProtocols() {
  const container = $("#protocol-options");
  container.replaceChildren();
  state.taxonomy.protocols.forEach((protocol) => {
    const meta = protocolMeta[protocol.id] || { label: protocol.name };
    const selected = state.protocols.has(protocol.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-card protocol-card ${selected ? "selected" : ""}`;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", meta.label);
    button.innerHTML = `<span class="card-symbol protocol-mark">${meta.logo ? `<img src="./protocols/${themedLogo(meta.logo)}" alt="" width="28" height="28" />` : ""}</span><strong>${meta.label}</strong>`;
    button.addEventListener("click", () => {
      if (selected && state.protocols.size === 1) {
        showToast("A client build needs at least one tunnel protocol.");
        return;
      }
      selected ? state.protocols.delete(protocol.id) : state.protocols.add(protocol.id);
      render();
    });
    container.append(button);
  });
}

function appendFeatureGroup(container, category, listClass) {
  const group = document.createElement("section");
  group.className = "feature-group";
  const heading = document.createElement("h3");
  heading.id = `${container.id}-${category.id}`;
  heading.textContent = category.name;
  group.setAttribute("aria-labelledby", heading.id);
  const list = document.createElement("div");
  list.className = listClass;
  group.append(heading, list);
  container.append(group);
  return list;
}

function renderFeatures() {
  const optionalList = $("#feature-options");
  const coreList = $("#core-features");
  optionalList.replaceChildren();
  coreList.replaceChildren();
  const query = state.query.trim().toLowerCase();
  const matches = allFeatures().filter((feature) => {
    const haystack = [feature.id, feature.name, featureShort[feature.id], feature.category.name].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  const groups = new Map();
  matches.forEach((feature) => {
    const isCore = state.rules.core.includes(feature.id);
    const container = isCore ? coreList : optionalList;
    const groupKey = `${container.id}-${feature.category.id}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, appendFeatureGroup(container, feature.category, "feature-list"));
    }
    const selected = isCore || state.optionalFeatures.has(feature.id);
    const reason = unsupportedReason(feature.id);
    const label = featureShort[feature.id] || feature.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "feature-card" + (selected ? " selected" : "") + (isCore ? " core" : "");
    button.disabled = Boolean(reason);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-disabled", String(isCore || Boolean(reason)));
    button.setAttribute("aria-label", label + (isCore ? ", included" : "") + (reason ? ", unavailable" : ""));
    button.title = reason || (isCore ? "Included in every app" : feature.name);

    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = label;
    copy.append(name);
    if (reason) {
      const explanation = document.createElement("small");
      explanation.textContent = reason.split(" (")[0];
      copy.append(explanation);
    }
    const control = document.createElement("span");
    control.className = "feature-control";
    control.setAttribute("aria-hidden", "true");
    control.innerHTML = isCore
      ? '<svg class="lock-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
      : '<i class="toggle-dot">' + (selected ? "✓" : "+") + '</i>';
    button.append(copy, control);
    button.addEventListener("click", () => toggleFeature(feature.id));
    groups.get(groupKey).append(button);
  });

  $("#included-count").textContent = coreList.querySelectorAll(".feature-card").length;
  $("#included-features").hidden = coreList.childElementCount === 0;
  if (query) $("#included-features").open = true;
  optionalList.hidden = optionalList.childElementCount === 0;
  $("#empty-features").hidden = matches.length > 0;
}

function proofSummary() {
  const entries = selectedFeatureIds().map((id) => ({ id, ...proofFor(id) }));
  const counts = { proven: 0, partial: 0, historical: 0, untested: 0, no: 0 };
  entries.forEach((entry) => { counts[entry.state] = (counts[entry.state] || 0) + 1; });
  const score = entries.length ? Math.round(((counts.proven + counts.partial * 0.5) / entries.length) * 100) : 0;
  return { entries, counts, score };
}

function renderManifest() {
  const os = currentOs();
  const runtime = runtimeFor(os);
  const selected = selectedFeatureIds();
  const optional = new Set(state.optionalFeatures);
  const proof = proofSummary();
  const source = state.provenance?.sources[`${os}-app`];
  $("#build-provenance").textContent = source
    ? `Source ${source.revision.slice(0, 8)} · ${proof.counts.historical ? "Evidence needs review" : "View source status"}`
    : "Source revision unavailable";
  $("#manifest-os-icon").innerHTML = `<img src="./logos/${platformLogo()}" alt="" width="20" height="20" />`;
  $(".runtime-mini").innerHTML = `<img src="./logos/${runtime.logo}" alt="" width="22" height="22" />`;
  $("#manifest-platform").textContent = platformLabels[state.platform] || state.platform;
  $("#manifest-runtime").textContent = runtime.manifest;
  $("#manifest-feature-count").textContent = selected.length;

  const protocols = $("#manifest-protocols");
  protocols.replaceChildren();
  [...state.protocols].forEach((id) => {
    const chip = document.createElement("span");
    const meta = protocolMeta[id];
    if (meta?.logo) {
      const logo = document.createElement("img");
      logo.src = `./protocols/${themedLogo(meta.logo)}`;
      logo.alt = "";
      logo.width = 16;
      logo.height = 16;
      chip.append(logo);
    }
    chip.append(document.createTextNode(meta?.label || id));
    protocols.append(chip);
  });

  const features = $("#manifest-features");
  features.replaceChildren();
  state.taxonomy.featureCategories.forEach((category) => {
    const members = category.features.filter((feature) => selected.includes(feature.id));
    if (!members.length) return;
    const list = appendFeatureGroup(features, category, "manifest-feature-list");
    members.forEach(({ id }) => {
      const chip = document.createElement("span");
      chip.textContent = featureShort[id] || id;
      if (optional.has(id)) chip.className = "optional";
      list.append(chip);
    });
  });

  const warning = $("#manifest-warning");
  let warningText = "";
  if (state.syncStatus?.status !== "synced") {
    warningText = "The latest source sync failed. This configuration uses the last validated catalogue.";
  } else if (Date.now() - Date.parse(state.syncStatus.checkedAt) > 120 * 60000) {
    warningText = "Source synchronization is overdue. Check Sources & sync for the last validated revisions.";
  } else if (state.platform === "windows-11-home-laptop" && state.optionalFeatures.has("kill-switch")) {
    warningText = "Daily-use laptop rule: do not run live tunnel or kill-switch tests on this machine.";
  } else if (state.platform === "macos-apple-silicon") {
    warningText = "Apple silicon is built but not live-proven in the current matrix.";
  } else if (proof.counts.untested + proof.counts.no > proof.entries.length / 2) {
    warningText = "Most selected modules still need platform-specific live proof for this variant.";
  }
  warning.hidden = !warningText;
  warning.textContent = warningText;
}

function buildPayload() {
  const os = currentOs();
  const runtime = runtimeFor(os);
  const proof = proofSummary();
  return {
    schema: 2,
    catalogueRevision: state.catalogueRevision,
    snapshotUrl: state.snapshotUrl,
    provenance: state.provenance,
    appTypes: Object.keys(appTypeLabels).filter((id) => state.appTypes.has(id)),
    platform: {
      id: state.platform,
      os,
      label: platformLabels[state.platform] || state.platform,
      note: currentPlatformMeta()?.note || null,
    },
    runtime: { id: os === "android" ? "android-bridge" : "electron", label: runtime.name },
    protocols: [...state.protocols].sort(),
    features: selectedFeatureIds().map((id) => ({
      id,
      core: state.rules.core.includes(id),
      proof: proofFor(id).state,
      recordedProof: proofFor(id).recordedState,
      evidence: proofFor(id).evidence,
      testedRevision: proofFor(id).testedRevision,
    })),
    proof: { score: proof.score, counts: proof.counts },
  };
}

function buildBrief() {
  const payload = buildPayload();
  const core = payload.features.filter((feature) => feature.core).map((feature) => feature.id);
  const optional = payload.features.filter((feature) => !feature.core).map((feature) => feature.id);
  return [
    "SENTINEL CLIENT BUILD BRIEF",
    "",
    `App types: ${payload.appTypes.map((id) => appTypeLabels[id]).join(", ")}`,
    `Platform: ${payload.platform.label} (${payload.platform.id})`,
    `Runtime: ${payload.runtime.label}`,
    `Catalogue: ${payload.catalogueRevision}`,
    `Snapshot: ${payload.snapshotUrl}`,
    `Source revision: ${payload.provenance.sources[`${payload.platform.os}-app`].revision}`,
    `Protocols: ${payload.protocols.join(", ")}`,
    `Core modules: ${core.join(", ")}`,
    `Optional modules: ${optional.length ? optional.join(", ") : "none"}`,
    `Current evidence: ${payload.proof.counts.proven} proven, ${payload.proof.counts.partial} partial, ${payload.proof.counts.historical} historical results requiring review, ${payload.proof.counts.untested + payload.proof.counts.no} untested/unavailable`,
    payload.platform.note ? `Platform note: ${payload.platform.note}` : "",
    "",
    "Build requirements:",
    "- Resolve every selected feature through the composer rules before generating files.",
    "- Carry platform-specific evidence and outstanding test work into TESTING.md.",
    "- Run full-tunnel and kill-switch tests only on a disposable VM, namespace, or emulator.",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

async function copyBrief() {
  const text = buildBrief();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showToast("Build brief copied.");
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(buildPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sentinel-build-${state.platform}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Build manifest downloaded.");
}

function renderEvidence() {
  const proof = proofSummary();
  $("#evidence-title").textContent = platformLabels[state.platform] || state.platform;
  $("#evidence-summary").textContent = `${proof.counts.proven} current proven · ${proof.counts.historical} historical results · ${proof.counts.untested + proof.counts.no} untested or unavailable`;
  const list = $("#evidence-list");
  list.replaceChildren();
  proof.entries.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "evidence-item";
    const feature = featureById(entry.id);
    const protocolNote = state.matrix.features?.[entry.id]?.protocols;
    const header = document.createElement("header");
    const name = document.createElement("strong");
    name.textContent = featureShort[entry.id] || feature?.name || entry.id;
    const badge = document.createElement("span");
    badge.className = `state-chip ${entry.state}`;
    badge.textContent = entry.state === "historical" ? `${entry.recordedState} · historical` : entry.state;
    header.append(name, badge);
    item.append(header);
    if (entry.evidence) {
      const text = document.createElement("p");
      text.className = "evidence-reference";
      text.textContent = entry.evidence;
      item.append(text);
    }
    if (protocolNote) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Protocol scope";
      const text = document.createElement("p");
      text.textContent = protocolNote;
      details.append(summary, text);
      item.append(details);
    }
    if (entry.sourceUrl) {
      const link = document.createElement("a");
      link.href = entry.evidenceUrl || entry.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = entry.evidenceUrl ? "View test evidence" : "View source revision";
      item.append(link);
    }
    const implementationLink = document.createElement("a");
    implementationLink.href = `./features.html?feature=${encodeURIComponent(entry.id)}&platform=${encodeURIComponent(currentOs())}`;
    implementationLink.textContent = "Creators & testing";
    const implementationRow = document.createElement("p");
    implementationRow.append(implementationLink);
    item.append(implementationRow);
    list.append(item);
  });
}

function openEvidence() {
  renderEvidence();
  $("#evidence-dialog").showModal();
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function render() {
  renderAppTypes();
  renderOsOptions();
  renderRuntime();
  renderProtocols();
  renderFeatures();
  renderManifest();
}

function bindEvents() {
  document.querySelectorAll('#app-type-options input').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked && state.appTypes.size === 1) {
        input.checked = true;
        showToast("Choose at least 1 app type.");
        return;
      }
      if (input.checked) {
        state.appTypes.add(input.value);
      } else {
        state.appTypes.delete(input.value);
      }
      renderAppTypes();
    });
  });
  document.addEventListener("themechange", () => {
    document.querySelectorAll('img[src^="./logos/"], img[src^="./protocols/"]').forEach((image) => {
      image.setAttribute("src", themedLogo(image.getAttribute("src")));
    });
  });
  $("#feature-search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderFeatures();
  });
  $("#copy-brief").addEventListener("click", copyBrief);
  $("#download-json").addEventListener("click", downloadJson);
  $("#reset-build").addEventListener("click", () => {
    state.appTypes = new Set(["free"]);
    state.platform = "windows-11-x64";
    state.protocols = new Set(["wireguard"]);
    state.optionalFeatures = new Set(["kill-switch"]);
    state.query = "";
    $("#feature-search").value = "";
    render();
    showToast("Configuration reset.");
  });
  $("#open-evidence").addEventListener("click", openEvidence);
  $("#close-evidence").addEventListener("click", () => $("#evidence-dialog").close());
  $("#evidence-dialog").addEventListener("click", (event) => {
    if (event.target === $("#evidence-dialog")) $("#evidence-dialog").close();
  });
}

async function init() {
  try {
    const { catalogue, status, snapshotUrl } = await loadGeneration();
    state.provenance = catalogue.provenance;
    state.catalogueRevision = catalogue.revision;
    state.snapshotUrl = snapshotUrl;
    state.syncStatus = status;
    state.taxonomy = catalogue.taxonomy;
    state.matrix = catalogue.matrix;
    state.rules = catalogue.rules;
    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    document.querySelector(".composer-layout").innerHTML = '<div class="load-error"><h2>Source data is unavailable</h2><p>Reload to try again, or check the latest synchronization.</p><a href="./sources.html">View sources & sync</a></div>';
  }
}

init();
