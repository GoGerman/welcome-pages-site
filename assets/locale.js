const languagesURL = new URL('../locales/', import.meta.url);
const preferenceKey = 'welcomeplugin.language';
const rightToLeft = new Set(['ar', 'fa', 'he']);
const browserAliases = {iw: 'he', in: 'id', nb: 'no', nn: 'no', tl: 'fil'};
const latinAmericanSpanish = new Set([
  'ar', 'bo', 'br', 'bz', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'gt', 'hn', 'mx',
  'ni', 'pa', 'pe', 'pr', 'py', 'sv', 'us', 'uy', 've', '419',
]);
const translatableAttributes = ['alt', 'aria-label', 'label'];

function browserTag(code) {
  return code.replace('_', '-');
}

function keyFor(code) {
  return code.toLowerCase().replaceAll('_', '-');
}

function readPreference() {
  try {
    return localStorage.getItem(preferenceKey);
  } catch {
    return null;
  }
}

function savePreference(preference) {
  try {
    localStorage.setItem(preferenceKey, preference);
  } catch {
    // The selector still applies to this page when storage is unavailable.
  }
}

function browserLocale(canonical) {
  for (const language of [...(navigator.languages ?? []), navigator.language]) {
    if (!language) continue;
    const tag = keyFor(language);
    const exact = canonical(tag);
    if (exact) return exact;

    const [base, qualifier, afterScript] = tag.split('-');
    const script = /^[a-z]{4}$/.test(qualifier ?? '') ? qualifier : undefined;
    const regionCandidate = script ? afterScript : qualifier;
    const region = /^(?:[a-z]{2}|\d{3})$/.test(regionCandidate ?? '') ? regionCandidate : undefined;
    let code = browserAliases[base] ?? base;
    if (base === 'zh') {
      code = script === 'hant' || ['tw', 'hk', 'mo'].includes(region) ? 'zh_TW' : 'zh_CN';
    } else if (base === 'pt') {
      code = region && region !== 'br' ? 'pt_PT' : 'pt_BR';
    } else if (base === 'es' && latinAmericanSpanish.has(region)) {
      code = 'es_419';
    }
    const fallback = canonical(code);
    if (fallback) return fallback;
  }
  return 'en';
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Locale data unavailable');
  return response.json();
}

function collectMessages() {
  const messages = Array.from(document.querySelectorAll('[data-i18n]'), element => {
    const parts = new Map(Array.from(element.children).filter(child => child.dataset.i18nPart)
      .map(child => [child.dataset.i18nPart, child]));
    const original = parts.size
      ? Array.from(element.childNodes, child => child.dataset?.i18nPart
        ? '{' + child.dataset.i18nPart + '}' : child.textContent).join('')
      : element.textContent;
    return {element, key: element.dataset.i18n, original, parts};
  });

  for (const attribute of translatableAttributes) {
    const binding = 'data-i18n-' + attribute;
    for (const element of document.querySelectorAll('[' + binding + ']')) {
      messages.push({
        element,
        attribute,
        key: element.getAttribute(binding),
        original: element.getAttribute(attribute),
      });
    }
  }
  return messages;
}

function matchesParts(text, parts) {
  if (!parts?.size) return true;
  const names = Array.from(text.matchAll(/\{(\w+)\}/g), match => match[1]);
  return names.length === parts.size && new Set(names).size === parts.size && names.every(name => parts.has(name));
}

function setMessage(message, text) {
  const {element, attribute, parts} = message;
  if (attribute) {
    element.setAttribute(attribute, text);
  } else if (parts.size) {
    const nodes = text.split(/\{(\w+)\}/g).map((value, index) =>
      index % 2 ? parts.get(value) : document.createTextNode(value));
    element.replaceChildren(...nodes);
  } else {
    element.textContent = text;
  }
}

function setURLPreference(preference) {
  const url = new URL(location.href);
  if (preference === 'auto') url.searchParams.delete('lang');
  else url.searchParams.set('lang', preference);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

function protectSelectBounds(select) {
  // The native select has no clickable label. Guard synthesized touch targets
  // on its actual bounds as well; keyboard and assistive input remain native.
  const isInside = point => {
    const {left, right, top, bottom} = select.getBoundingClientRect();
    return point.clientX >= left && point.clientX < right && point.clientY >= top && point.clientY < bottom;
  };

  select.addEventListener('pointerdown', event => {
    if (!isInside(event)) event.preventDefault();
  });
  for (const type of ['touchstart', 'touchend']) {
    select.addEventListener(type, event => {
      if (Array.from(event.changedTouches).some(touch => !isInside(touch))) event.preventDefault();
    }, {passive: false});
  }
}

export async function startLanguages(request) {
  const picker = document.querySelector('[data-language-picker]');
  if (!picker) return;

  let available;
  try {
    available = await readJSON(new URL('languages.json', languagesURL));
  } catch {
    return;
  }
  if (!Array.isArray(available)) return;
  available = available.filter(row => /^[a-z]{2,3}(?:_[A-Z0-9]{2,3})?$/.test(row?.code) &&
    typeof row.name === 'string' && row.name.trim());
  const codes = new Map(available.map(({code}) => [keyFor(code), code]));
  if (!codes.has('en')) return;

  const canonical = code => typeof code === 'string' ? codes.get(keyFor(code)) : undefined;
  const choice = code => code === 'auto' ? code : canonical(code);
  const select = picker.querySelector('[data-language-select]');
  const automaticName = select.querySelector('[data-automatic-language-name]');
  const status = document.querySelector('[data-language-status]');
  const notes = document.querySelectorAll('[data-illustration-note]');
  const links = Array.from(document.querySelectorAll('[data-language-link]'), element =>
    ({element, url: new URL(element.getAttribute('href'), location.href)}));
  const messages = collectMessages();
  const catalogs = new Map();

  for (const {code, name} of available) {
    const option = new Option(name, code);
    option.lang = browserTag(code);
    option.dir = rightToLeft.has(code) ? 'rtl' : 'ltr';
    select.append(option);
  }

  function updateAutomaticName(code) {
    if (!automaticName) return;
    automaticName.textContent = available.find(language => language.code === code).name;
    automaticName.lang = browserTag(code);
    automaticName.dir = rightToLeft.has(code) ? 'rtl' : 'ltr';
  }

  function catalogFor(code) {
    if (code === 'en') return Promise.resolve({});
    if (!catalogs.has(code)) {
      catalogs.set(code, readJSON(new URL(code + '.json', languagesURL)).catch(() => {
        catalogs.delete(code);
        return null;
      }));
    }
    return catalogs.get(code);
  }

  let requestedLanguage;
  let painting = 0;
  async function paint(code) {
    if (requestedLanguage === code) return;
    requestedLanguage = code;
    const attempt = ++painting;
    const catalog = await catalogFor(code);
    if (attempt !== painting) return;
    if (catalog === null) requestedLanguage = undefined;

    let translatedCount = 0;
    for (const message of messages) {
      const candidate = catalog?.[message.key];
      const translated = typeof candidate === 'string' && candidate.trim() && matchesParts(candidate, message.parts);
      setMessage(message, translated ? candidate : message.original);
      if (code === 'en') message.element.removeAttribute('lang');
      else message.element.lang = translated ? browserTag(code) : 'en';
      if (translated) translatedCount++;
    }

    const displayed = translatedCount ? code : 'en';
    document.documentElement.lang = browserTag(displayed);
    document.documentElement.dir = rightToLeft.has(displayed) ? 'rtl' : 'ltr';
    for (const note of notes) note.hidden = displayed === 'en';
    status.hidden = code === 'en' || translatedCount === messages.length;
  }

  const initialPreference = choice(new URLSearchParams(location.search).get('lang')) ?? choice(readPreference());
  let preference = initialPreference ?? 'auto';
  const browserLanguage = browserLocale(canonical);
  let locale = preference === 'auto' ? browserLanguage : preference;
  updateAutomaticName(browserLanguage);

  function display() {
    select.value = preference;
    for (const {element,url} of links) {
      // Carry the language to another guide, but never the extension ID or pin state.
      if (preference === 'auto') url.searchParams.delete('lang');
      else url.searchParams.set('lang', preference);
      element.href = url.pathname + url.search + url.hash;
    }
    void paint(locale);
  }

  // A saved website value or a shared URL must not overwrite an installed app on load.
  let pendingPreference;
  let revision = 0;
  let syncing = false;
  let syncTimer;
  let paired = false;
  let pairedAutomaticLanguage;

  async function synchronize() {
    clearTimeout(syncTimer);
    if (!request || syncing || document.hidden) return;
    syncing = true;
    const currentRevision = revision;
    const pending = pendingPreference;
    try {
      const response = await request(pending
        ? {type: 'setWelcomeLanguage', locale: pending}
        : {type: 'getWelcomeLanguage'});
      const nextPreference = choice(response?.preference);
      const nextLocale = canonical(response?.locale);
      if (revision !== currentRevision || !nextPreference || !nextLocale || (pending && response.ok !== true)) return;

      if (!pending && paired && preference !== nextPreference) {
        savePreference(nextPreference);
        setURLPreference(nextPreference);
      }
      paired = true;
      if (automaticName && nextPreference === 'auto') {
        pairedAutomaticLanguage = nextLocale;
        updateAutomaticName(nextLocale);
      }
      pendingPreference = undefined;
      preference = nextPreference;
      locale = nextLocale;
      display();
    } finally {
      syncing = false;
      if (revision !== currentRevision) {
        void synchronize();
      } else if (paired && !document.hidden) {
        syncTimer = setTimeout(synchronize, 2500);
      }
    }
  }

  protectSelectBounds(select);
  select.addEventListener('change', () => {
    const next = choice(select.value);
    if (!next) return;
    preference = next;
    locale = next === 'auto' ? (pairedAutomaticLanguage ?? browserLocale(canonical)) : next;
    savePreference(next);
    setURLPreference(next);
    pendingPreference = next;
    revision++;
    display();
    void synchronize();
  });
  document.addEventListener('visibilitychange', synchronize);
  window.addEventListener('focus', synchronize);
  window.addEventListener('pageshow', synchronize);
  window.addEventListener('languagechange', () => {
    const browserLanguage = browserLocale(canonical);
    if (!pairedAutomaticLanguage) updateAutomaticName(browserLanguage);
    if (preference !== 'auto') return;
    if (paired) {
      void synchronize();
      return;
    }
    locale = browserLanguage;
    display();
  });
  display();
  picker.hidden = false;
  void synchronize();
}
