/* ============================================
   Flexfundament App – Shared Logic
   ============================================ */

// --- Firebase Config (replace with real values) ---
const firebaseConfig = {
  apiKey: "AIzaSyDh0smzZqkiCqUV93_LsoMaml0698noysQ",
  authDomain: "flexfundament-app.firebaseapp.com",
  databaseURL: "https://flexfundament-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "flexfundament-app",
  storageBucket: "flexfundament-app.firebasestorage.app",
  messagingSenderId: "149430854074",
  appId: "1:149430854074:web:71af3453ca5e6f1b1a7d83"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// --- Auth ---

/** Google Sign-In via redirect (PWA/iOS safe) */
function signInWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function() {
    console.log('Persistence set to LOCAL, starting redirect');
    return auth.signInWithRedirect(provider);
  });
}

/** Sign out */
function signOut() {
  return auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
}

/**
 * Initialize app with auth guard.
 * On login page: waits for getRedirectResult() first, then listens to auth state.
 * On other pages: redirects to index.html if not logged in.
 * Calls callback(user) when authenticated.
 */
function initApp(callback) {
  var isLoginPage = window.location.pathname.endsWith('index.html') ||
                    window.location.pathname.endsWith('/');

  if (isLoginPage) {
    // On login page: first handle redirect result, then check auth state
    console.log('getRedirectResult started');
    auth.getRedirectResult().then(function(result) {
      console.log('getRedirectResult resolved: ' + (result.user ? result.user.email : null));
      if (result.user) {
        console.log('redirecting to dashboard');
        window.location.href = 'dashboard.html';
        return;
      }
      // No redirect result — listen for existing session
      auth.onAuthStateChanged(function(user) {
        console.log('onAuthStateChanged: ' + (user ? user.email : null));
        if (user) {
          console.log('redirecting to dashboard');
          window.location.href = 'dashboard.html';
        } else {
          if (callback) callback(null);
        }
      });
    }).catch(function(err) {
      console.error('getRedirectResult error:', err);
      // Fallback: listen for auth state anyway
      auth.onAuthStateChanged(function(user) {
        console.log('onAuthStateChanged (fallback): ' + (user ? user.email : null));
        if (user) {
          console.log('redirecting to dashboard');
          window.location.href = 'dashboard.html';
        } else {
          if (callback) callback(null);
        }
      });
    });
  } else {
    // On protected pages: just check auth state
    auth.onAuthStateChanged(function(user) {
      console.log('onAuthStateChanged: ' + (user ? user.email : null));
      if (user) {
        if (callback) callback(user);
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  // Initialize online/offline detection
  initOnlineStatus();
}

// --- Online/Offline Detection ---
let isOnline = navigator.onLine;

function initOnlineStatus() {
  updateOnlineUI();

  window.addEventListener('online', function() {
    isOnline = true;
    updateOnlineUI();
    showToast('Wieder online', 'success');
    // Sync all collections when back online
    syncAllCollections();
  });

  window.addEventListener('offline', function() {
    isOnline = false;
    updateOnlineUI();
    showToast('Offline-Modus', 'error');
  });
}

function updateOnlineUI() {
  var dots = document.querySelectorAll('.online-dot');
  var labels = document.querySelectorAll('.online-label');
  dots.forEach(function(dot) {
    dot.classList.toggle('offline', !isOnline);
  });
  labels.forEach(function(label) {
    label.textContent = isOnline ? 'Online' : 'Offline';
  });
}

function syncAllCollections() {
  var collections = ['projects', 'reports', 'documents', 'drives', 'costs'];
  collections.forEach(function(col) {
    syncWithFirebase(col);
  });
}

// --- Local Storage Sync ---

/**
 * Save data to localStorage and attempt Firebase sync.
 * Adds savedAt, savedBy, deleted fields automatically.
 */
function saveToLocal(collection, id, data) {
  var user = auth.currentUser;
  data.savedAt = Date.now();
  data.savedBy = user ? user.uid : 'anonymous';
  if (data.deleted === undefined) data.deleted = false;

  // Save to localStorage
  var store = loadFromLocal(collection);
  store[id] = data;
  localStorage.setItem('ff_' + collection, JSON.stringify(store));

  // Attempt Firebase sync
  if (isOnline) {
    syncItemToFirebase(collection, id, data);
  }

  return data;
}

/**
 * Load all items of a collection from localStorage.
 * Returns object { id: data, ... }
 */
function loadFromLocal(collection) {
  try {
    var raw = localStorage.getItem('ff_' + collection);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Get list of non-deleted items from a collection, sorted by savedAt descending.
 */
function getActiveItems(collection) {
  var store = loadFromLocal(collection);
  return Object.keys(store)
    .map(function(id) {
      var item = store[id];
      item.id = id;
      return item;
    })
    .filter(function(item) { return item.deleted !== true; })
    .sort(function(a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
}

/**
 * Get a single item by ID from localStorage.
 */
function getItemById(collection, id) {
  var store = loadFromLocal(collection);
  var item = store[id] || null;
  if (item) item.id = id;
  return item;
}

/**
 * Sync a single item to Firebase.
 */
function syncItemToFirebase(collection, id, data) {
  return db.ref(collection + '/' + id).set(data).catch(function(err) {
    // Silently fail — will retry on next online event
  });
}

/**
 * Full two-way sync for a collection.
 * Merges Firebase data with localStorage using Last-Write-Wins (savedAt).
 */
function syncWithFirebase(collection) {
  if (!isOnline) return Promise.resolve();

  return db.ref(collection).once('value').then(function(snapshot) {
    var remoteData = snapshot.val() || {};
    var localData = loadFromLocal(collection);
    var merged = {};
    var changed = false;

    // Merge: iterate all keys from both sources
    var allKeys = new Set(Object.keys(localData).concat(Object.keys(remoteData)));
    allKeys.forEach(function(id) {
      var local = localData[id];
      var remote = remoteData[id];

      if (local && remote) {
        // Both exist: Last-Write-Wins
        if ((local.savedAt || 0) >= (remote.savedAt || 0)) {
          merged[id] = local;
          // Push local version to Firebase if newer
          if ((local.savedAt || 0) > (remote.savedAt || 0)) {
            syncItemToFirebase(collection, id, local);
          }
        } else {
          merged[id] = remote;
          changed = true;
        }
      } else if (local) {
        merged[id] = local;
        syncItemToFirebase(collection, id, local);
      } else {
        merged[id] = remote;
        changed = true;
      }
    });

    // Save merged data to localStorage
    localStorage.setItem('ff_' + collection, JSON.stringify(merged));
    return merged;
  }).catch(function(err) {
    // Offline or permission error — keep local data
  });
}

// --- Soft Delete ---

/**
 * Soft-delete an item with confirmation dialog.
 * Returns true if deleted, false if cancelled.
 */
function softDelete(collection, id, label) {
  var msg = 'Soll "' + (label || 'dieser Eintrag') + '" wirklich geloescht werden?';
  if (!confirm(msg)) return false;

  var store = loadFromLocal(collection);
  if (store[id]) {
    store[id].deleted = true;
    store[id].savedAt = Date.now();
    localStorage.setItem('ff_' + collection, JSON.stringify(store));

    if (isOnline) {
      syncItemToFirebase(collection, id, store[id]);
    }
  }
  return true;
}

// --- Autocomplete ---

/**
 * Get unique values for a field from a collection (for autocomplete suggestions).
 */
function getAutocompleteSuggestions(collection, field) {
  var items = getActiveItems(collection);
  var values = {};
  items.forEach(function(item) {
    var val = item[field];
    if (val && typeof val === 'string' && val.trim()) {
      values[val.trim()] = true;
    } else if (Array.isArray(val)) {
      val.forEach(function(v) {
        if (v && typeof v === 'string' && v.trim()) {
          values[v.trim()] = true;
        }
      });
    }
  });
  return Object.keys(values).sort();
}

// --- Image Compression ---

/**
 * Compress an image file to maxWidth and maxSizeMB.
 * Returns a Promise resolving to a Blob.
 */
function compressImage(file, maxWidth, maxSizeMB) {
  maxWidth = maxWidth || 1920;
  maxSizeMB = maxSizeMB || 5;

  return new Promise(function(resolve, reject) {
    // Skip non-images
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Skip if already small enough
    if (file.size <= maxSizeMB * 1024 * 1024) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        if (img.width <= maxWidth) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }
        compressWithCanvas(img, file.type, maxWidth, maxSizeMB, resolve);
        URL.revokeObjectURL(url);
      };
      img.onerror = function() {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
      return;
    }

    var img2 = new Image();
    var url2 = URL.createObjectURL(file);
    img2.onload = function() {
      compressWithCanvas(img2, file.type, maxWidth, maxSizeMB, resolve);
      URL.revokeObjectURL(url2);
    };
    img2.onerror = function() {
      URL.revokeObjectURL(url2);
      resolve(file);
    };
    img2.src = url2;
  });
}

function compressWithCanvas(img, mimeType, maxWidth, maxSizeMB, resolve) {
  var canvas = document.createElement('canvas');
  var ratio = Math.min(1, maxWidth / img.width);
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;

  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(function(blob) {
    resolve(blob || img);
  }, mimeType || 'image/jpeg', 0.85);
}

// --- Navigation ---

/**
 * Render the top navigation bar.
 * @param {string} activeTab - one of: 'dashboard', 'projects', 'calendar', 'drives', 'costs', 'documents', 'reports'
 */
function renderNav(activeTab) {
  var moreItems = ['reports', 'drives', 'costs', 'documents'];
  var isMoreActive = moreItems.indexOf(activeTab) !== -1;

  var nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('role', 'navigation');

  var tabs = document.createElement('div');
  tabs.className = 'nav-tabs';

  // Main tabs
  var mainTabs = [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'projects', label: 'Projekte', href: 'projects.html' },
    { id: 'calendar', label: 'Kalender', href: 'calendar.html' }
  ];

  mainTabs.forEach(function(tab) {
    var a = document.createElement('a');
    a.className = 'nav-tab' + (activeTab === tab.id ? ' active' : '');
    a.href = tab.href;
    a.textContent = tab.label;
    tabs.appendChild(a);
  });

  // More dropdown
  var more = document.createElement('div');
  more.className = 'nav-more';

  var moreBtn = document.createElement('button');
  moreBtn.className = 'nav-tab' + (isMoreActive ? ' active' : '');
  moreBtn.textContent = 'Mehr\u2026';
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var menu = more.querySelector('.nav-more-menu');
    var isOpen = menu.classList.contains('open');
    menu.classList.toggle('open');
    moreBtn.setAttribute('aria-expanded', !isOpen);
  });

  var menu = document.createElement('div');
  menu.className = 'nav-more-menu';

  var moreLinks = [
    { id: 'reports', label: 'Einsatzberichte', href: 'reports.html' },
    { id: 'drives', label: 'Fahrtenbuch', href: 'drives.html' },
    { id: 'costs', label: 'Kosten', href: 'costs.html' },
    { id: 'documents', label: 'Dokumente', href: 'documents.html' }
  ];

  moreLinks.forEach(function(link) {
    var a = document.createElement('a');
    a.className = 'nav-more-item' + (activeTab === link.id ? ' active' : '');
    a.href = link.href;
    a.textContent = link.label;
    menu.appendChild(a);
  });

  more.appendChild(moreBtn);
  more.appendChild(menu);
  tabs.appendChild(more);

  // Online indicator in nav
  var indicator = document.createElement('div');
  indicator.className = 'online-indicator';
  indicator.style.marginLeft = 'auto';
  indicator.innerHTML = '<span class="online-dot' + (isOnline ? '' : ' offline') + '"></span>' +
                        '<span class="online-label">' + (isOnline ? 'Online' : 'Offline') + '</span>';
  tabs.appendChild(indicator);

  nav.appendChild(tabs);

  // Insert nav at top of body
  document.body.insertBefore(nav, document.body.firstChild);

  // Close dropdown when clicking outside
  document.addEventListener('click', function() {
    var openMenu = document.querySelector('.nav-more-menu.open');
    if (openMenu) {
      openMenu.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // User menu / sign-out (accessible via long-press on indicator or separate button)
}

// --- Utilities ---

/** Format date as DD.MM.YYYY */
function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return day + '.' + month + '.' + year;
}

/** Format time as HH:MM */
function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

/** Generate a Firebase-style push ID */
function generateId() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var now = Date.now();
  var id = '';
  for (var i = 0; i < 8; i++) {
    id = chars.charAt(now % 64) + id;
    now = Math.floor(now / 64);
  }
  for (var j = 0; j < 12; j++) {
    id += chars.charAt(Math.floor(Math.random() * 64));
  }
  return id;
}

/**
 * Show a toast message.
 * @param {string} message
 * @param {string} type - 'success', 'error', or '' (default)
 * @param {number} duration - ms (default 3000)
 */
function showToast(message, type, duration) {
  duration = duration || 3000;

  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(function() {
    toast.classList.add('show');
  });

  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/**
 * Initialize collapsible sections.
 * Call after DOM is ready.
 */
function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var section = header.closest('.collapsible');
      section.classList.toggle('open');
    });
  });
}

/**
 * Get URL parameter by name.
 */
function getUrlParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(err) {
      // Service worker registration failed
    });
  });
}
