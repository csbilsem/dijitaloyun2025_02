async function loadGames() {
  const res = await fetch("/data/games.json", { cache: "no-store" });
  if (!res.ok) throw new Error("games.json okunamadı");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .trim();
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a,b) => a.localeCompare(b, "tr"));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  children.forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

/* ---------------- INDEX (Oyunlar) ---------------- */

function renderIndex(games) {
  const gamesGrid = document.getElementById("gamesGrid");
  if (!gamesGrid) return;

  const searchInput = document.getElementById("searchInput");
  const studentSelect = document.getElementById("studentSelect");
  const tagSelect = document.getElementById("tagSelect");
  const clearBtn = document.getElementById("clearBtn");
  const emptyState = document.getElementById("emptyState");

  const statTotal = document.getElementById("statTotal");
  const statShown = document.getElementById("statShown");

  // dropdownlar
  const students = uniqSorted(games.map(g => g.studentName).filter(Boolean));
  students.forEach(name => studentSelect.appendChild(el("option", { value: name }, [name])));

  const tags = uniqSorted(games.flatMap(g => Array.isArray(g.tags) ? g.tags : []).filter(Boolean));
  tags.forEach(t => tagSelect.appendChild(el("option", { value: t }, [t])));

  // chipler (etiketler)
  const tagChips = document.getElementById("tagChips");
  let activeChip = "";
  function rebuildChips() {
    tagChips.innerHTML = "";
    if (tags.length === 0) return;

    tagChips.appendChild(
      el("button", {
        class: "chip",
        type: "button",
        "data-active": activeChip === "" ? "true" : "false",
        onclick: () => { activeChip = ""; tagSelect.value = ""; applyFilters(); rebuildChips(); }
      }, ["Tümü"])
    );

    tags.forEach(t => {
      tagChips.appendChild(
        el("button", {
          class: "chip",
          type: "button",
          "data-active": activeChip === t ? "true" : "false",
          onclick: () => { activeChip = t; tagSelect.value = t; applyFilters(); rebuildChips(); }
        }, [t])
      );
    });
  }

  // URL param ile öğrenci filtresi (students sayfasından gelince)
  const params = new URLSearchParams(location.search);
  const presetStudent = params.get("student");
  if (presetStudent && students.includes(presetStudent)) {
    studentSelect.value = presetStudent;
  }

  function card(game) {
    const cover = el("div", { class: "cover" });
    if (game.cover) {
      cover.appendChild(el("img", { src: game.cover, alt: `${game.gameName} kapak` }));
    }

    const tagsLocal = Array.isArray(game.tags) ? game.tags.slice(0, 3) : [];
    const pills = el("div", { class: "pills" }, [
      ...tagsLocal.map((t, i) => el("span", { class: i % 2 === 0 ? "pill" : "pill alt" }, [t]))
    ]);

    const actions = el("div", { class: "card-actions" }, [
      el("a", {
        class: "link-btn primary",
        href: `/oyunlar/${game.slug}/`,
        target: "_blank",
        rel: "noopener"
      }, ["Oyunu Aç"]),
      el("a", {
        class: "link-btn",
        href: `/students/?student=${encodeURIComponent(game.studentName || "")}`
      }, ["Öğrenci"])
    ]);

    return el("article", { class: "card" }, [
      cover,
      el("div", { class: "card-body" }, [
        el("h3", { class: "title" }, [game.gameName || "İsimsiz Oyun"]),
        el("div", { class: "meta" }, [game.studentName || "İsimsiz Öğrenci"]),
        el("p", { class: "desc" }, [game.description || "Açıklama eklenmemiş."]),
        pills,
        actions
      ])
    ]);
  }

  function applyFilters() {
    const q = norm(searchInput.value);
    const s = studentSelect.value;
    const t = tagSelect.value;

    const filtered = games.filter(g => {
      const matchQ =
        !q ||
        norm(g.gameName).includes(q) ||
        norm(g.studentName).includes(q) ||
        norm((g.description || "")).includes(q);

      const matchS = !s || g.studentName === s;

      const gTags = Array.isArray(g.tags) ? g.tags : [];
      const matchT = !t || gTags.includes(t);

      return matchQ && matchS && matchT;
    });

    gamesGrid.innerHTML = "";
    filtered.forEach(g => gamesGrid.appendChild(card(g)));

    statTotal.textContent = `Toplam: ${games.length}`;
    statShown.textContent = `Gösterilen: ${filtered.length}`;
    emptyState.hidden = filtered.length !== 0;
  }

  searchInput.addEventListener("input", applyFilters);
  studentSelect.addEventListener("change", applyFilters);
  tagSelect.addEventListener("change", () => { activeChip = tagSelect.value; rebuildChips(); applyFilters(); });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    studentSelect.value = "";
    tagSelect.value = "";
    activeChip = "";
    // URL param temiz
    if (location.search) history.replaceState({}, "", location.pathname);
    rebuildChips();
    applyFilters();
  });

  rebuildChips();
  applyFilters();
}

/* ---------------- STUDENTS (Öğrenciler) ---------------- */

function renderStudents(games) {
  const studentsGrid = document.getElementById("studentsGrid");
  if (!studentsGrid) return;

  const studentSearch = document.getElementById("studentSearch");
  const studentCount = document.getElementById("studentCount");
  const studentsEmpty = document.getElementById("studentsEmpty");

  const map = new Map();
  for (const g of games) {
    const name = g.studentName || "İsimsiz Öğrenci";
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(g);
  }

  const list = Array.from(map.entries())
    .map(([name, arr]) => ({ name, count: arr.length }))
    .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));

  function studentCard(item) {
    return el("article", { class: "card" }, [
      el("div", { class: "cover" }),
      el("div", { class: "card-body" }, [
        el("h3", { class: "title" }, [item.name]),
        el("div", { class: "meta" }, [`Oyun sayısı: ${item.count}`]),
        el("div", { class: "card-actions" }, [
          el("a", {
            class: "link-btn primary",
            href: `/?student=${encodeURIComponent(item.name)}`
          }, ["Oyunlarını Gör"])
        ])
      ])
    ]);
  }

  function applyStudentFilter() {
    const q = norm(studentSearch.value);
    const filtered = list.filter(x => !q || norm(x.name).includes(q));

    studentsGrid.innerHTML = "";
    filtered.forEach(x => studentsGrid.appendChild(studentCard(x)));

    studentCount.textContent = `Toplam: ${list.length}`;
    studentsEmpty.hidden = filtered.length !== 0;
  }

  studentSearch.addEventListener("input", applyStudentFilter);
  applyStudentFilter();
}

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const games = await loadGames();
    renderIndex(games);
    renderStudents(games);
  } catch (e) {
    console.error(e);
    const grid = document.getElementById("gamesGrid") || document.getElementById("studentsGrid");
    if (grid) grid.innerHTML = `<div class="empty"><h3>Veri yüklenemedi</h3><p>/data/games.json kontrol edin.</p></div>`;
  }
});
