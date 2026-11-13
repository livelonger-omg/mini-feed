/* ============================================================
   碎语 Chatter — 纯原生逻辑
   结构：config → storage → format → render → actions → init
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- 配置 ---------------- */
  var CONFIG = {
    STORAGE_KEY: "chatter.posts.v1",
    MAX_LEN: 280,
    MAX_POSTS: 300,
    NICKNAME: "我",
    AVATAR_CHAR: "我"
  };

  var AVATAR_GRADIENTS = [
    "linear-gradient(135deg,#5B8CFF,#A97BFF)",
    "linear-gradient(135deg,#4EE0B5,#5B8CFF)",
    "linear-gradient(135deg,#A97BFF,#FF9BC4)",
    "linear-gradient(135deg,#F0B429,#FF6B6B)",
    "linear-gradient(135deg,#5B8CFF,#4EE0B5)",
    "linear-gradient(135deg,#8FA3FF,#C08BFF)"
  ];

  /* ---------------- DOM ---------------- */
  var el = {
    form: document.getElementById("composer"),
    input: document.getElementById("post-input"),
    submit: document.getElementById("publish-btn"),
    counter: document.getElementById("char-count"),
    feed: document.getElementById("feed"),
    empty: document.getElementById("empty-state"),
    count: document.getElementById("stream-count"),
    badge: document.getElementById("storage-badge")
  };

  /* ---------------- 状态 ---------------- */
  var state = {
    posts: [],          // 唯一数据源，按 createdAt 倒序
    storageOK: true,
    memoryStore: null,  // localStorage 不可用时的降级存储
    composing: false
  };

  /* ---------------- 存储层 ---------------- */
  var storage = {
    available: function () {
      try {
        var k = "__chatter_probe__";
        window.localStorage.setItem(k, "1");
        window.localStorage.removeItem(k);
        return true;
      } catch (err) {
        return false;
      }
    },

    read: function () {
      if (!state.storageOK) {
        return state.memoryStore ? state.memoryStore.slice() : [];
      }
      try {
        var raw = window.localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!raw) return [];
        var parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(function (item) {
          return (
            item &&
            typeof item.id === "string" &&
            typeof item.text === "string" &&
            typeof item.createdAt === "number"
          );
        });
      } catch (err) {
        try {
          window.localStorage.removeItem(CONFIG.STORAGE_KEY);
        } catch (e) {
          /* 忽略：存储不可用 */
        }
        return [];
      }
    },

    write: function (posts) {
      var snapshot = posts.slice();
      if (!state.storageOK) {
        state.memoryStore = snapshot;
        return;
      }
      try {
        window.localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(snapshot));
      } catch (err) {
        // 配额溢出或被禁用：退化为内存模式，功能不中断
        state.storageOK = false;
        state.memoryStore = snapshot;
        markStorageMode();
      }
    }
  };

  /* ---------------- 工具 ---------------- */
  function createId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function hashIndex(str) {
    var h = 0;
    for (var i = 0; i < str.length; i += 1) {
      h = (h * 31 + str.charCodeAt(i)) % 9973;
    }
    return h % AVATAR_GRADIENTS.length;
  }

  function formatTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 0) diff = 0;
    var min = 60 * 1000;
    var hour = 60 * min;
    var day = 24 * hour;

    if (diff < min) return "刚刚";
    if (diff < hour) return Math.floor(diff / min) + " 分钟前";
    if (diff < day) return Math.floor(diff / hour) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";

    var d = new Date(ts);
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function markStorageMode() {
    if (state.storageOK || !el.badge) return;
    el.badge.textContent = "内存模式";
    el.badge.title = "浏览器本地存储不可用，本次内容仅在当前页面有效";
  }

  /* ---------------- 渲染 ---------------- */
  function buildDeleteButton(post) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "item__delete";
    btn.setAttribute("data-id", post.id);
    btn.setAttribute("aria-label", "删除这条内容");
    btn.title = "删除";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>' +
      '<path d="M10 11v5M14 11v5"/></svg>';
    return btn;
  }

  function buildItem(post, isNew) {
    var li = document.createElement("li");
    li.className = "item" + (isNew ? " item--enter" : "");
    li.setAttribute("data-id", post.id);

    var avatar = document.createElement("div");
    avatar.className = "item__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.style.background = AVATAR_GRADIENTS[hashIndex(post.id)];
    avatar.textContent = CONFIG.AVATAR_CHAR;

    var body = document.createElement("div");
    body.className = "item__body";

    var head = document.createElement("div");
    head.className = "item__head";

    var name = document.createElement("span");
    name.className = "item__name";
    name.textContent = CONFIG.NICKNAME;

    var time = document.createElement("time");
    time.className = "item__time";
    time.dateTime = new Date(post.createdAt).toISOString();
    time.textContent = formatTime(post.createdAt);

    var text = document.createElement("p");
    text.className = "item__text";
    text.textContent = post.text;

    head.appendChild(name);
    head.appendChild(time);
    body.appendChild(head);
    body.appendChild(text);

    li.appendChild(avatar);
    li.appendChild(body);
    li.appendChild(buildDeleteButton(post));
    return li;
  }

  function toggleEmpty() {
    if (!el.empty) return;
    el.empty.hidden = state.posts.length > 0;
  }

  function updateCount() {
    if (el.count) el.count.textContent = state.posts.length + " 条";
  }

  function renderList() {
    var fragment = document.createDocumentFragment();
    state.posts.forEach(function (post) {
      fragment.appendChild(buildItem(post, false));
    });
    el.feed.textContent = "";
    el.feed.appendChild(fragment);
    toggleEmpty();
    updateCount();
  }

  function prependItem(post) {
    var node = buildItem(post, true);
    el.feed.insertBefore(node, el.feed.firstChild);
    toggleEmpty();
    updateCount();
  }

  function refreshTimes() {
    var nodes = el.feed.querySelectorAll(".item");
    for (var i = 0; i < nodes.length; i += 1) {
      var id = nodes[i].getAttribute("data-id");
      var post = state.posts.filter(function (p) {
        return p.id === id;
      })[0];
      var time = nodes[i].querySelector(".item__time");
      if (post && time) time.textContent = formatTime(post.createdAt);
    }
  }

  /* ---------------- 交互反馈 ---------------- */
  function updateComposerState() {
    var len = el.input.value.length;
    el.counter.textContent = len + " / " + CONFIG.MAX_LEN;
    el.counter.classList.toggle("is-warning", len >= CONFIG.MAX_LEN * 0.8 && len <= CONFIG.MAX_LEN);
    el.counter.classList.toggle("is-over", len > CONFIG.MAX_LEN);
    el.submit.disabled = el.input.value.trim().length === 0 || len > CONFIG.MAX_LEN;
  }

  function autoGrow() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 320) + "px";
  }

  /* ---------------- 动作 ---------------- */
  function publish() {
    var value = el.input.value;
    var text = value.trim();

    if (!text) {
      el.input.focus();
      return;
    }
    if (value.length > CONFIG.MAX_LEN) {
      el.input.focus();
      return;
    }

    var post = {
      id: createId(),
      text: text,
      createdAt: Date.now()
    };

    state.posts.unshift(post);
    if (state.posts.length > CONFIG.MAX_POSTS) {
      state.posts = state.posts.slice(0, CONFIG.MAX_POSTS);
      renderList();
    } else {
      prependItem(post);
    }

    storage.write(state.posts);

    el.input.value = "";
    el.input.style.height = "";
    updateComposerState();
    el.input.focus();
  }

  function removePost(id) {
    var target = state.posts.filter(function (p) {
      return p.id === id;
    })[0];
    if (!target) return;

    var confirmed = window.confirm("确定删除这条内容吗？删除后无法恢复。");
    if (!confirmed) return;

    state.posts = state.posts.filter(function (p) {
      return p.id !== id;
    });
    storage.write(state.posts);

    var node = el.feed.querySelector('.item[data-id="' + id + '"]');
    if (node) {
      node.classList.add("item--leaving");
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        toggleEmpty();
        updateCount();
      }, 200);
    } else {
      toggleEmpty();
      updateCount();
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    el.input.addEventListener("input", function () {
      updateComposerState();
      autoGrow();
    });

    el.input.addEventListener("compositionstart", function () {
      state.composing = true;
    });

    el.input.addEventListener("compositionend", function () {
      state.composing = false;
      updateComposerState();
    });

    el.input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (state.composing || event.isComposing) return;
      event.preventDefault();
      publish();
    });

    el.form.addEventListener("submit", function (event) {
      event.preventDefault();
      publish();
    });

    el.feed.addEventListener("click", function (event) {
      var btn = event.target.closest(".item__delete");
      if (!btn) return;
      removePost(btn.getAttribute("data-id"));
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshTimes();
    });

    window.addEventListener("focus", refreshTimes);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    state.storageOK = storage.available();
    state.posts = storage.read().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    renderList();
    updateComposerState();
    bindEvents();

    if (!state.storageOK) markStorageMode();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
