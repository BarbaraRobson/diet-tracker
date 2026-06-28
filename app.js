const CATEGORIES = [
  { id: "protein", name: "Meat & Protein", target: 2.5, color: "var(--bar)", guide: "100g red meat, lamb, pork, chicken, fish or tofu, 2 eggs, or 150g of legumes" },
  { id: "grain", name: "Bread & Cereals", target: 3, color: "var(--bar)", guide: "1 slice of bread (40g), 1/2 cup cooked rice or pasta, 25g oats or 1 potato (150g)" },
  { id: "veg", name: "Vegetables", target: 2.5, color: "var(--bar)", guide: "150g raw vegetables, 1 cup cooked or salad vegetables, or 2 small tomatoes" },
  { id: "fruit", name: "Fruit", target: 2, color: "var(--bar)", guide: "150g fruit, 1 orange or apple, 2 apricots, kiwi fruits or plums, or 30g dried fruit" },
  { id: "dairy", name: "Dairy", target: 3, color: "var(--bar)", guide: "1 cup milk, 50g cheese, 200g greek yoghurt or 1/2 cup cottage cheese (165g)" },
  { id: "fat", name: "Healthy Fats & Oils", target: 3, color: "var(--bar)", guide: "1 teaspoon oil, 20g avocado or 7g nuts" },
  { id: "indulgence", name: "Indulgences", target: 0, color: "var(--indulgence)", guide: "4 small squares of chocolate, 150mL wine, 1 scoop ice cream, 1 fun size packet of chips, 1 biscuit, 285ml beer, or 30ml spirits" }
];

const STORE_KEY = "diet-tracker-v1";
const LEGACY_STORE_KEY = "csiro-diet-tracker-v1";
const state = {
  selectedDate: todayKey(),
  activeView: "today",
  editingMealId: null,
  data: loadData()
};

const el = {
  bottomNav: document.getElementById("bottomNav"),
  datePicker: document.getElementById("datePicker"),
  prevDay: document.getElementById("prevDay"),
  nextDay: document.getElementById("nextDay"),
  progressList: document.getElementById("progressList"),
  mealList: document.getElementById("mealList"),
  addMeal: document.getElementById("addMeal"),
  cancelMeal: document.getElementById("cancelMeal"),
  mealTitle: document.getElementById("mealTitle"),
  mealForm: document.getElementById("mealForm"),
  mealName: document.getElementById("mealName"),
  mealFields: document.getElementById("mealFields"),
  deleteMeal: document.getElementById("deleteMeal"),
  copyMealButton: document.getElementById("copyMealButton"),
  closeCopy: document.getElementById("closeCopy"),
  copySearch: document.getElementById("copySearch"),
  copyList: document.getElementById("copyList"),
  weekSummary: document.getElementById("weekSummary"),
  guideList: document.getElementById("guideList"),
  toast: document.getElementById("toast")
};

function todayKey() {
  return dateToKey(new Date());
}

function dateToKey(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function keyToDate(key) {
  return new Date(`${key}T12:00:00`);
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_STORE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.data));
}

function ensureDay(key = state.selectedDate) {
  if (!state.data[key]) {
    state.data[key] = { meals: [] };
  }
  return state.data[key];
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(key, weekday = true) {
  return keyToDate(key).toLocaleDateString("en-AU", {
    weekday: weekday ? "long" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function changeDate(offset) {
  const date = keyToDate(state.selectedDate);
  date.setDate(date.getDate() + offset);
  state.selectedDate = dateToKey(date);
  renderToday();
}

function dayTotals(key = state.selectedDate) {
  const totals = Object.fromEntries(CATEGORIES.map((cat) => [cat.id, 0]));
  (state.data[key]?.meals || []).forEach((meal) => {
    CATEGORIES.forEach((cat) => {
      totals[cat.id] += Number(meal.units?.[cat.id] || 0);
    });
  });
  return totals;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function renderProgressCard(cat, value) {
  const denominator = cat.id === "indulgence" ? Math.max(1, value, 1) : Math.max(cat.target, value, 0.1);
  const baseValue = cat.id === "indulgence" ? Math.min(value, 1) : Math.min(value, cat.target);
  const extraValue = Math.max(0, value - (cat.id === "indulgence" ? 1 : cat.target));
  const baseWidth = Math.min(100, (baseValue / denominator) * 100);
  const extraWidth = Math.min(100 - baseWidth, (extraValue / denominator) * 100);
  const targetLabel = cat.id === "indulgence" ? "0" : formatNumber(cat.target);
  const extraColor = cat.id === "veg" ? cat.color : "var(--excess)";
  return `
    <article class="progress-card">
      <div class="progress-top">
        <span class="progress-title">${cat.name}</span>
        <span class="progress-score">${formatNumber(value)}/${targetLabel}</span>
      </div>
      <div class="bar" aria-label="${cat.name} ${formatNumber(value)} of ${targetLabel}">
        <div class="bar-fill" style="width:${baseWidth}%; background:${cat.color}"></div>
        <div class="bar-extra" style="width:${extraWidth}%; background:${extraColor}"></div>
      </div>
    </article>
  `;
}

function renderToday() {
  setView("today");
  const day = ensureDay();
  const totals = dayTotals();
  el.datePicker.value = state.selectedDate;
  el.progressList.innerHTML = CATEGORIES.map((cat) => renderProgressCard(cat, totals[cat.id])).join("");
  el.mealList.innerHTML = day.meals.length
    ? day.meals.map(renderMealCard).join("")
    : `<article class="meal-card"><p class="meal-date">No meals entered for this day yet.</p></article>`;
}

function renderMealCard(meal) {
  const units = CATEGORIES
    .filter((cat) => Number(meal.units?.[cat.id] || 0) > 0)
    .map((cat) => `${cat.name}: ${formatNumber(Number(meal.units[cat.id]))}`)
    .join(" · ") || "All categories are zero";
  return `
    <article class="meal-card">
      <button type="button" data-edit-meal="${meal.id}">
        <span class="meal-title-row">
          <span class="meal-title">${escapeHtml(meal.name)}</span>
          <span class="meal-date">${meal.time || ""}</span>
        </span>
        <p class="meal-units">${escapeHtml(units)}</p>
      </button>
      ${state.selectedDate === todayKey() ? "" : `<button class="ghost-button" type="button" data-copy-to-today="${meal.id}">Copy to today</button>`}
    </article>
  `;
}

function openMealForm(mealId = null, template = null) {
  state.editingMealId = mealId;
  const meal = mealId ? ensureDay().meals.find((item) => item.id === mealId) : template;
  el.mealTitle.textContent = mealId ? "Edit meal" : "Add meal";
  el.mealName.value = meal?.name || "";
  el.deleteMeal.hidden = !mealId;
  el.mealFields.innerHTML = CATEGORIES.map((cat) => {
    const value = Number(meal?.units?.[cat.id] || 0);
    return `
      <label class="field">
        <span>${cat.name}</span>
        <div class="number-row">
          <button class="step-button" type="button" data-step="${cat.id}" data-dir="-0.5">-</button>
          <input inputmode="decimal" pattern="[0-9]*[.]?[0-9]*" id="field-${cat.id}" value="${formatNumber(value)}" aria-label="${cat.name} units">
          <button class="step-button" type="button" data-step="${cat.id}" data-dir="0.5">+</button>
        </div>
      </label>
    `;
  }).join("");
  setView("meal");
}

function saveMeal(event) {
  event.preventDefault();
  const day = ensureDay();
  const units = {};
  CATEGORIES.forEach((cat) => {
    const input = document.getElementById(`field-${cat.id}`);
    units[cat.id] = Math.max(0, Number.parseFloat(input.value) || 0);
  });
  const now = new Date();
  const enteredName = el.mealName.value.trim();
  const meal = {
    id: state.editingMealId || uid(),
    name: enteredName || now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }),
    time: now.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }),
    units
  };
  const index = day.meals.findIndex((item) => item.id === meal.id);
  if (index >= 0) {
    day.meals[index] = meal;
  } else {
    day.meals.push(meal);
  }
  saveData();
  renderToday();
  showToast("Meal saved");
}

function deleteCurrentMeal() {
  if (!state.editingMealId) return;
  const day = ensureDay();
  day.meals = day.meals.filter((meal) => meal.id !== state.editingMealId);
  saveData();
  renderToday();
  showToast("Meal removed");
}

function recentMeals() {
  const current = keyToDate(state.selectedDate);
  const earliest = new Date(current);
  earliest.setDate(current.getDate() - 21);
  return Object.entries(state.data)
    .filter(([key]) => key < state.selectedDate && key >= dateToKey(earliest))
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([date, day]) => (day.meals || []).map((meal) => ({ ...meal, date })));
}

function renderCopyList() {
  const query = el.copySearch.value.trim().toLowerCase();
  const meals = recentMeals().filter((meal) => {
    const haystack = `${meal.name} ${meal.date} ${CATEGORIES.map((cat) => meal.units?.[cat.id] || "").join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
  el.copyList.innerHTML = meals.length
    ? meals.map((meal) => `
      <article class="copy-card">
        <button type="button" data-copy-meal="${meal.id}" data-copy-date="${meal.date}">
          <span class="copy-title-row">
            <span class="copy-title">${escapeHtml(meal.name)}</span>
            <span class="meal-date">${formatDate(meal.date, false)}</span>
          </span>
          <p class="copy-units">${escapeHtml(compactUnits(meal))}</p>
        </button>
      </article>
    `).join("")
    : `<article class="copy-card"><p class="meal-date">No matching meals from the previous 21 days.</p></article>`;
}

function compactUnits(meal) {
  return CATEGORIES
    .filter((cat) => Number(meal.units?.[cat.id] || 0) > 0)
    .map((cat) => `${cat.name}: ${formatNumber(Number(meal.units[cat.id]))}`)
    .join(" · ") || "All categories are zero";
}

function copyMeal(date, mealId) {
  const source = state.data[date]?.meals.find((meal) => meal.id === mealId);
  if (!source) return;
  openMealForm(null, { ...source, name: source.name, units: { ...source.units } });
}

function copyMealToToday(mealId) {
  const source = state.data[state.selectedDate]?.meals.find((meal) => meal.id === mealId);
  if (!source) return;
  const targetDate = todayKey();
  const targetDay = ensureDay(targetDate);
  targetDay.meals.push({
    id: uid(),
    name: source.name,
    time: new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }),
    units: { ...source.units }
  });
  state.selectedDate = targetDate;
  saveData();
  renderToday();
  showToast("Meal copied to today");
}

function renderWeek() {
  setView("week");
  const end = keyToDate(state.selectedDate);
  const dates = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - i);
    const key = dateToKey(date);
    if ((state.data[key]?.meals || []).length) {
      dates.push(key);
    }
  }
  const totals = Object.fromEntries(CATEGORIES.map((cat) => [cat.id, 0]));
  dates.forEach((date) => {
    const day = dayTotals(date);
    CATEGORIES.forEach((cat) => {
      totals[cat.id] += day[cat.id];
    });
  });
  const dayCount = dates.length || 0;
  el.weekSummary.innerHTML = dayCount
    ? CATEGORIES.map((cat) => {
      const targetTotal = cat.target * dayCount;
      const targetLabel = cat.id === "indulgence" ? "0" : formatNumber(targetTotal);
      return `<article class="week-card"><h3>${cat.name}</h3><p>${formatNumber(totals[cat.id])}/${targetLabel} over ${dayCount} day${dayCount === 1 ? "" : "s"}</p></article>`;
    }).join("")
    : `<article class="week-card"><p>No meal data entered yet.</p></article>`;
}

function renderGuide() {
  setView("guide");
  el.guideList.innerHTML = CATEGORIES.map((cat) => `
    <article class="guide-card">
      <h3>${cat.name}</h3>
      <p>1 unit = ${cat.guide}</p>
    </article>
  `).join("");
}

async function exportCsv() {
  const header = ["date", "meal_name", "meal_time", ...CATEGORIES.map((cat) => cat.name)];
  const rows = [header];
  Object.entries(state.data).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, day]) => {
    (day.meals || []).forEach((meal) => {
      rows.push([date, meal.name, meal.time || "", ...CATEGORIES.map((cat) => meal.units?.[cat.id] || 0)]);
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `diet-tracker-${todayKey()}.csv`;
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: link.download,
        types: [{ description: "CSV file", accept: { "text/csv": [".csv"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      showToast("CSV saved");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        showToast("Export cancelled");
        return;
      }
    }
  }
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("CSV exported");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.getElementById(`${view}View`).classList.add("active");
  el.addMeal.hidden = view !== "today";
  el.bottomNav.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.setTimeout(() => el.toast.classList.remove("show"), 1800);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function bindEvents() {
  el.bottomNav.addEventListener("click", (event) => {
    const view = event.target.dataset.view;
    if (view === "today") renderToday();
    if (view === "week") renderWeek();
    if (view === "guide") renderGuide();
    if (view === "export") exportCsv();
  });
  el.datePicker.addEventListener("change", () => {
    if (!el.datePicker.value) return;
    state.selectedDate = el.datePicker.value;
    renderToday();
  });
  el.prevDay.addEventListener("click", () => changeDate(-1));
  el.nextDay.addEventListener("click", () => changeDate(1));
  el.addMeal.addEventListener("click", () => openMealForm());
  el.cancelMeal.addEventListener("click", renderToday);
  el.mealForm.addEventListener("submit", saveMeal);
  el.deleteMeal.addEventListener("click", deleteCurrentMeal);
  el.mealFields.addEventListener("click", (event) => {
    const catId = event.target.dataset.step;
    if (!catId) return;
    const input = document.getElementById(`field-${catId}`);
    const nextValue = Math.max(0, (Number.parseFloat(input.value) || 0) + Number(event.target.dataset.dir));
    input.value = formatNumber(nextValue);
  });
  el.mealList.addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-to-today]");
    if (copyButton) {
      copyMealToToday(copyButton.dataset.copyToToday);
      return;
    }
    const button = event.target.closest("[data-edit-meal]");
    if (button) openMealForm(button.dataset.editMeal);
  });
  el.copyMealButton.addEventListener("click", () => {
    setView("copy");
    el.copySearch.value = "";
    renderCopyList();
  });
  el.closeCopy.addEventListener("click", renderToday);
  el.copySearch.addEventListener("input", renderCopyList);
  el.copyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-meal]");
    if (button) copyMeal(button.dataset.copyDate, button.dataset.copyMeal);
  });
  document.querySelectorAll(".backToToday").forEach((button) => button.addEventListener("click", renderToday));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

bindEvents();
renderToday();

/* metadata: GPT-5 Codex; time: 2026-06-28 00:00 Australia/Sydney; date: 2026-06-28; prompt: Create a local-first PWA app called "CSIRO Diet Tracker" for iPhone with daily category tracking, meal editing/copying, 7-day summary, unit guide, and CSV export. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:05 Australia/Sydney; date: 2026-06-28; prompt: Tighten CSIRO Diet Tracker requirements so 7-day totals use the past 7 calendar days and previous-day meal cards can copy entries to today. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:35 Australia/Sydney; date: 2026-06-28; prompt: Remove CSIRO wording, move menu to bottom, standardize progress colours, add date picker/today navigation, let CSV export choose save location, and make 7-day totals end at selected day. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:39 Australia/Sydney; date: 2026-06-28; prompt: Clean literal newline markers introduced by scripted edits and tidy stale CSS selector after requested Diet Tracker UI changes. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:48 Australia/Sydney; date: 2026-06-28; prompt: Remove the Today button beside the date picker because date navigation already covers today. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:53 Australia/Sydney; date: 2026-06-28; prompt: Remove the Today/day heading between the date picker and the food unit list. */
/* metadata: GPT-5 Codex; time: 2026-06-28 10:58 Australia/Sydney; date: 2026-06-28; prompt: Remove the duplicate formatted date beneath Diet Tracker so only the date picker displays the selected date. */
/* metadata: GPT-5 Codex; time: 2026-06-28 11:02 Australia/Sydney; date: 2026-06-28; prompt: Extend meal-copy search window from 5 recent days to 21 recent days. */
