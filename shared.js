/* ============================================
   Flexfundament App – Shared Logic
   ============================================ */

// --- Firebase Config ---
var firebaseConfig = {
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
var auth = firebase.auth();
var db = firebase.database();
var storage = firebase.storage();

// Explicitly set LOCAL persistence on init
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(err) {
  console.warn('setPersistence error:', err);
});

// --- Auth ---

/**
 * Detect if current page is the login page.
 * Works on GitHub Pages subpaths and local dev.
 */
function isLoginPage() {
  var path = window.location.pathname;
  // Matches: /index.html, /foo/index.html, /, /foo/, /foo (no extension = likely root)
  if (path.endsWith('/index.html')) return true;
  if (path.endsWith('/')) return true;
  // No file extension and no other known page = assume login
  var knownPages = ['dashboard', 'projects', 'reports', 'documents', 'drives', 'costs', 'calendar'];
  for (var i = 0; i < knownPages.length; i++) {
    if (path.indexOf(knownPages[i]) !== -1) return false;
  }
  return true;
}

/**
 * Google Sign-In: Popup first, fallback to redirect if blocked.
 * Returns a Promise that rejects with a displayable error on failure.
 */
function signInWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  console.log('[Auth] signInWithGoogle called');

  return auth.signInWithPopup(provider).then(function(result) {
    console.log('[Auth] signInWithPopup success:', result.user.email);
    // onAuthStateChanged will handle the redirect
  }).catch(function(error) {
    console.warn('[Auth] signInWithPopup error:', error.code, error.message);

    // Popup blocked/closed → fallback to redirect
    if (error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request') {
      console.log('[Auth] Falling back to signInWithRedirect');
      return auth.signInWithRedirect(provider);
    }

    // All other errors: re-throw with user-friendly message
    var msg = 'Login fehlgeschlagen: ';
    switch (error.code) {
      case 'auth/unauthorized-domain':
        msg += 'Diese Domain ist nicht autorisiert. Bitte "' + window.location.hostname +
               '" in der Firebase Console unter Authentication → Settings → Authorized Domains hinzufuegen.';
        break;
      case 'auth/operation-not-allowed':
        msg += 'Google Sign-In ist in der Firebase Console nicht aktiviert.';
        break;
      case 'auth/network-request-failed':
        msg += 'Netzwerkfehler. Bitte Internetverbindung pruefen.';
        break;
      case 'auth/internal-error':
        msg += 'Interner Firebase-Fehler. Bitte spaeter erneut versuchen.';
        break;
      default:
        msg += error.code + ' – ' + error.message;
    }
    error.displayMessage = msg;
    throw error;
  });
}

/** Sign out and redirect to login */
function signOut() {
  return auth.signOut().then(function() {
    window.location.href = 'index.html';
  });
}

/**
 * Initialize app with auth guard.
 * On login page: handles redirect result + listens to auth state.
 * On protected pages: waits for auth to resolve, redirects if not logged in.
 */
function initApp(callback) {
  var onLogin = isLoginPage();
  console.log('[Auth] initApp, isLoginPage=' + onLogin, 'path=' + window.location.pathname);

  if (onLogin) {
    _initLoginPage(callback);
  } else {
    _initProtectedPage(callback);
  }

  // Initialize online/offline detection
  initOnlineStatus();

  // Clean up Base64 bloat from localStorage on startup
  cleanupLocalStorage();
}

/**
 * Login page initialization:
 * 1. Check getRedirectResult (for redirect fallback)
 * 2. Listen to onAuthStateChanged
 * 3. Show login button only when we're sure no user is logged in
 */
function _initLoginPage(callback) {
  var handled = false;

  // Handle redirect result (fires if user came back from signInWithRedirect)
  console.log('[Auth] getRedirectResult started');
  auth.getRedirectResult().then(function(result) {
    console.log('[Auth] getRedirectResult resolved:', result.user ? result.user.email : 'null');
    if (result.user && !handled) {
      handled = true;
      console.log('[Auth] Redirecting to dashboard (from redirect result)');
      window.location.href = 'dashboard.html';
    }
  }).catch(function(err) {
    console.error('[Auth] getRedirectResult error:', err.code, err.message);
  });

  // Main auth state listener
  auth.onAuthStateChanged(function(user) {
    console.log('[Auth] onAuthStateChanged:', user ? user.email : 'null');
    if (user && !handled) {
      handled = true;
      console.log('[Auth] Redirecting to dashboard (from onAuthStateChanged)');
      window.location.href = 'dashboard.html';
    } else if (!user && !handled) {
      // Definitely no user — show login UI
      console.log('[Auth] No user — showing login button');
      if (callback) callback(null);
    }
  });
}

/**
 * Protected page initialization:
 * Uses auth.onAuthStateChanged but gives Firebase time to restore the session.
 * Prevents the race condition where null fires before persistence is loaded.
 */
function _initProtectedPage(callback) {
  // Flag: has the first auth state fired?
  var resolved = false;

  auth.onAuthStateChanged(function(user) {
    console.log('[Auth] onAuthStateChanged (protected):', user ? user.email : 'null');

    if (user) {
      resolved = true;
      if (callback) callback(user);
      return;
    }

    if (resolved) {
      // User was logged in but signed out during session
      console.log('[Auth] User signed out, redirecting to login');
      window.location.href = 'index.html';
      return;
    }

    // First fire was null — might be a race condition.
    // Wait briefly for Firebase to load persisted session.
    resolved = true;
    console.log('[Auth] First auth state is null, waiting 1500ms for persistence...');
    setTimeout(function() {
      var currentUser = auth.currentUser;
      console.log('[Auth] After wait, currentUser:', currentUser ? currentUser.email : 'null');
      if (!currentUser) {
        console.log('[Auth] Confirmed: no user. Redirecting to login.');
        window.location.href = 'index.html';
      }
      // If currentUser exists, onAuthStateChanged will fire again with user
    }, 1500);
  });
}

// --- Online/Offline Detection ---
var isOnline = navigator.onLine;

function initOnlineStatus() {
  updateOnlineUI();

  window.addEventListener('online', function() {
    isOnline = true;
    updateOnlineUI();
    showToast('Wieder online', 'success');
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

  // Sync full data (with Base64) to Firebase if online
  if (isOnline) {
    syncItemToFirebase(collection, id, data);
  }

  // Strip Base64 data before writing to localStorage (5MB limit)
  var localData = stripBase64(JSON.parse(JSON.stringify(data)));

  var store = loadFromLocal(collection);
  store[id] = localData;
  localStorage.setItem('ff_' + collection, JSON.stringify(store));

  return data;
}

/**
 * Remove Base64 data fields from an object before localStorage storage.
 * Keeps URLs and metadata, removes large binary content.
 */
function stripBase64(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Strip known Base64 fields on the object itself
  if (typeof obj.fileDataUrl === 'string' && obj.fileDataUrl.length > 200) {
    obj.fileDataUrl = '';
  }
  if (typeof obj.dataUrl === 'string' && obj.dataUrl.length > 200) {
    obj.dataUrl = '';
  }

  // Strip Base64 from arrays of files/photos
  ['photos', 'files', 'accessFiles', 'obstaclePhotos', 'reportPhotos'].forEach(function(key) {
    if (Array.isArray(obj[key])) {
      obj[key] = obj[key].map(function(item) {
        if (item && typeof item.dataUrl === 'string' && item.dataUrl.length > 200) {
          item = JSON.parse(JSON.stringify(item));
          item.dataUrl = '';
        }
        return item;
      });
    }
  });

  return obj;
}

/**
 * Clean up existing localStorage data by removing Base64 bloat.
 * Called once on app start.
 */
function cleanupLocalStorage() {
  var collections = ['documents', 'reports', 'projects', 'drives', 'costs'];
  var cleaned = false;
  collections.forEach(function(col) {
    var store = loadFromLocal(col);
    var ids = Object.keys(store);
    ids.forEach(function(id) {
      var item = store[id];
      var before = JSON.stringify(item).length;
      store[id] = stripBase64(item);
      if (JSON.stringify(store[id]).length < before) cleaned = true;
    });
    if (cleaned) {
      try { localStorage.setItem('ff_' + col, JSON.stringify(store)); }
      catch (e) { /* ignore */ }
    }
  });
  // Remove old offline_doc_ keys
  var keysToRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf('offline_doc_') === 0) keysToRemove.push(key);
  }
  keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
  if (cleaned || keysToRemove.length) {
    console.log('[App] localStorage cleaned up');
  }
}

/**
 * Load all items of a collection from localStorage.
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
 * Get list of non-deleted items, sorted by savedAt descending.
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
 * Full two-way sync for a collection (Last-Write-Wins via savedAt).
 */
function syncWithFirebase(collection) {
  if (!isOnline) return Promise.resolve();

  return db.ref(collection).once('value').then(function(snapshot) {
    var remoteData = snapshot.val() || {};
    var localData = loadFromLocal(collection);
    var merged = {};

    var allKeys = new Set(Object.keys(localData).concat(Object.keys(remoteData)));
    allKeys.forEach(function(id) {
      var local = localData[id];
      var remote = remoteData[id];

      if (local && remote) {
        if ((local.savedAt || 0) >= (remote.savedAt || 0)) {
          merged[id] = local;
          if ((local.savedAt || 0) > (remote.savedAt || 0)) {
            syncItemToFirebase(collection, id, local);
          }
        } else {
          merged[id] = remote;
        }
      } else if (local) {
        merged[id] = local;
        syncItemToFirebase(collection, id, local);
      } else {
        merged[id] = remote;
      }
    });

    localStorage.setItem('ff_' + collection, JSON.stringify(merged));
    return merged;
  }).catch(function(err) {
    // Offline or permission error — keep local data
  });
}

// --- Soft Delete ---

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

function compressImage(file, maxWidth, maxSizeMB) {
  maxWidth = maxWidth || 1600;
  maxSizeMB = maxSizeMB || 2;
  var maxBytes = maxSizeMB * 1024 * 1024;

  return new Promise(function(resolve) {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      // Always compress through canvas (converts HEIC→JPEG, reduces size)
      compressWithCanvas(img, maxWidth, maxBytes, function(blob) {
        blob._originalSize = file.size;
        resolve(blob);
      });
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function compressWithCanvas(img, maxWidth, maxBytes, done) {
  var canvas = document.createElement('canvas');
  var ratio = Math.min(1, maxWidth / img.width);
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);

  var ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Iterative compression: start at 0.6, lower until under maxBytes
  var qualities = [0.6, 0.4, 0.3];
  var attempt = 0;

  function tryCompress() {
    var quality = qualities[attempt] || 0.3;
    canvas.toBlob(function(blob) {
      if (!blob) { done(new Blob([])); return; }
      if (blob.size <= maxBytes || attempt >= qualities.length - 1) {
        done(blob);
      } else {
        attempt++;
        tryCompress();
      }
    }, 'image/jpeg', quality);
  }

  tryCompress();
}

// --- Navigation ---

function renderNav(activeTab) {
  var moreItems = ['reports', 'drives', 'costs', 'documents'];
  var isMoreActive = moreItems.indexOf(activeTab) !== -1;

  var nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('role', 'navigation');

  var tabs = document.createElement('div');
  tabs.className = 'nav-tabs';

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

  var more = document.createElement('div');
  more.className = 'nav-more';

  var moreBtn = document.createElement('button');
  moreBtn.className = 'nav-tab' + (isMoreActive ? ' active' : '');
  moreBtn.textContent = 'Mehr\u2026';
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var m = more.querySelector('.nav-more-menu');
    var open = m.classList.contains('open');
    m.classList.toggle('open');
    moreBtn.setAttribute('aria-expanded', !open);
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

  var indicator = document.createElement('div');
  indicator.className = 'online-indicator';
  indicator.style.marginLeft = 'auto';
  indicator.innerHTML = '<span class="online-dot' + (isOnline ? '' : ' offline') + '"></span>' +
                        '<span class="online-label">' + (isOnline ? 'Online' : 'Offline') + '</span>';
  tabs.appendChild(indicator);

  nav.appendChild(tabs);
  document.body.insertBefore(nav, document.body.firstChild);

  document.addEventListener('click', function() {
    var openMenu = document.querySelector('.nav-more-menu.open');
    if (openMenu) {
      openMenu.classList.remove('open');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

// --- Utilities ---

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  return day + '.' + month + '.' + d.getFullYear();
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
}

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

function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(function(header) {
    header.addEventListener('click', function() {
      header.closest('.collapsible').classList.toggle('open');
    });
  });
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(err) {
      console.warn('SW registration failed:', err);
    });
  });
}
