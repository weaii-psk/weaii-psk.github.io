const searchInput = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const countLabel = document.getElementById("count");
const clearButton = document.getElementById("clear");
const toast = document.getElementById("toast");

let employees = [];
let faculties = [];
let functionNames = {};
let toastTimer;

// Normalizacja tekstu do wyszukiwania.
function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Zabezpieczenie tekstu przed wstawieniem do HTML.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

// Dopasowanie pracownika do wydziału.
function getFaculty(emp) {
  const parent = String(emp["Jednostka nadrzędna"] || "").trim();

  return (
    faculties.find(
      (f) => normalize(f.name) === normalize(parent),
    ) ||
    faculties.find(
      (f) =>
        normalize(parent).includes(normalize(f.name)) ||
        normalize(f.name).includes(normalize(parent)),
    ) ||
    null
  );
}

// Generowanie pojedynczego wiersza informacji.
function detail(label, value, href = "") {
  if (!value) return "";

  const content = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(value)}</a>`
    : `<strong>${escapeHtml(value)}</strong>`;

  return `
    <div class="detail">
      <dt>${escapeHtml(label)}</dt>
      <dd>${content}</dd>
    </div>`;
}

// Generowanie adresu e-mail z możliwością kopiowania.
function emailDetail(value) {
  if (!value) return "";

  const email = String(value).includes("@")
    ? String(value)
    : `${value}@tu.kielce.pl`;

  return `
    <div class="detail">
      <dt>E-mail</dt>
      <dd>
        <button
          class="copy-email"
          type="button"
          data-copy="${escapeHtml(email)}"
          title="Kliknij, aby skopiować adres"
        >${escapeHtml(email)} ⧉</button>
      </dd>
    </div>`;
}

// Renderowanie wyników wyszukiwania.
function render(list) {
  countLabel.textContent =
    `Znaleziono: ${list.length} ${
      list.length === 1 ? "pracownika" : "pracowników"
    }`;

  if (!list.length) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <strong>Nie znaleziono pracowników</strong>
        Spróbuj zmienić wyszukiwaną frazę.
      </div>`;

    return;
  }

  const collator = new Intl.Collator("pl", {
    sensitivity: "base",
    numeric: true,
  });

  const sortBy = (a, b) => collator.compare(a, b);

  // =========================================================
  // GRUPOWANIE:
  // Jednostka nadrzędna
  //   └── Jednostka organizacyjna
  //         └── Pracownicy
  // =========================================================

  const groups = new Map();

  for (const emp of list) {
    const parent =
      String(emp["Jednostka nadrzędna"] || "").trim() ||
      "Pozostałe jednostki";

    const unit =
      String(emp["Jednostka organizacyjna"] || "").trim() ||
      "Nie przypisano do jednostki organizacyjnej";

    if (!groups.has(parent)) {
      groups.set(parent, new Map());
    }

    const units = groups.get(parent);

    if (!units.has(unit)) {
      units.set(unit, []);
    }

    units.get(unit).push(emp);
  }

  // =========================================================
  // KARTA PRACOWNIKA
  // =========================================================

  function renderEmployee(emp) {
    const title = [
      emp["Tytuł naukowy"],
      emp["Imię"],
      emp["Nazwisko"],
    ]
      .filter(Boolean)
      .join(" ");

    const unit = emp["Jednostka organizacyjna"] || "";
    const facultyName = emp["Jednostka nadrzędna"] || "";
    const faculty = getFaculty(emp);

    const color = faculty?.color || "#555b66";
    const textColor = faculty?.textColor || "#ffffff";

    const phone = emp["Telefon"];

    const phoneHref = phone
      ? `tel:${String(phone).replace(/[^+\d]/g, "")}`
      : "";

    return `
      <article
        class="card"
        style="
          --faculty-color: ${escapeHtml(color)};
          --faculty-text: ${escapeHtml(textColor)};
        "
      >
        <h2>${escapeHtml(title || "Nie podano nazwiska")}</h2>

        <div class="badges">
          ${
            facultyName
              ? `
                <span
                  class="badge faculty-badge"
                  title="${escapeHtml(facultyName)}"
                >${escapeHtml(faculty?.shortName || facultyName)}</span>
              `
              : ""
          }

          ${
            unit
              ? `
                <span class="badge unit-badge">
                  ${escapeHtml(unit)}
                </span>
              `
              : ""
          }
        </div>

        <dl class="details">
          ${detail("Budynek", emp["Budynek"])}
          ${detail("Pokój", emp["Pokój"])}
          ${phone ? detail("Telefon", phone, phoneHref) : ""}
          ${emailDetail(emp["Email"])}

          ${
            emp["Stanowisko"]
              ? detail("Stanowisko", emp["Stanowisko"])
              : ""
          }
        </dl>
      </article>`;
  }

  // =========================================================
// WYNIKI WYSZUKIWANIA — BEZ GRUPOWANIA
// =========================================================

if (searchInput.value.trim() !== "") {
  const sortedEmployees = [...list].sort((a, b) =>
    sortBy(
      `${a["Nazwisko"] || ""} ${a["Imię"] || ""}`,
      `${b["Nazwisko"] || ""} ${b["Imię"] || ""}`,
    ),
  );

  resultsContainer.innerHTML = sortedEmployees
    .map(renderEmployee)
    .join("");

  return;
}

  // =========================================================
  // BUDOWANIE HIERARCHII
  // =========================================================

  resultsContainer.innerHTML = [...groups.entries()]
    .sort(([a], [b]) => sortBy(a, b))
    .map(([parent, units]) => {
      // Jednostki organizacyjne w obrębie jednostki nadrzędnej.
      const unitHtml = [...units.entries()]
        .sort(([a], [b]) => sortBy(a, b))
        .map(([unit, people]) => {
          // Sortowanie pracowników po nazwisku i imieniu.
          people.sort((a, b) =>
            sortBy(
              `${a["Nazwisko"] || ""} ${a["Imię"] || ""}`,
              `${b["Nazwisko"] || ""} ${b["Imię"] || ""}`,
            ),
          );

          return `
            <details class="unit-group">
              <summary class="unit-heading">
                <span>${escapeHtml(unit)}</span>
                <span class="group-count">(${people.length})</span>
              </summary>

              <div class="grid">
                ${people.map(renderEmployee).join("")}
              </div>
            </details>`;
        })
        .join("");

      // Łączna liczba pracowników w jednostce nadrzędnej.
      const total = [...units.values()].reduce(
        (sum, people) => sum + people.length,
        0,
      );

      // Jednostka nadrzędna zawiera jednostki organizacyjne.
      // Brak atrybutu "open" oznacza, że startuje zwinięta.
      return `
        <section class="parent-group">
          <details class="parent-group-details">
            <summary class="parent-heading">
              <span>${escapeHtml(parent)}</span>
              <span class="group-count">(${total})</span>
            </summary>

            ${unitHtml}
          </details>
        </section>`;
    })
    .join("");
}

// =========================================================
// WYSZUKIWANIE
// =========================================================

function filterEmployees() {
  const query = normalize(searchInput.value);

  const filtered = employees.filter((emp) =>
    Object.values(emp).some((value) =>
      normalize(value).includes(query),
    ),
  );

  render(filtered);
}

// =========================================================
// POWIADOMIENIA
// =========================================================

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

// =========================================================
// KOPIOWANIE TEKSTU
// =========================================================

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(`Skopiowano: ${value}`);
  } catch {
    const field = document.createElement("textarea");

    field.value = value;
    field.style.position = "fixed";
    field.style.opacity = "0";

    document.body.appendChild(field);
    field.select();

    const copied = document.execCommand("copy");

    field.remove();

    showToast(
      copied
        ? `Skopiowano: ${value}`
        : "Nie udało się skopiować adresu.",
    );
  }
}

// Obsługa przycisków kopiowania w kartach.
resultsContainer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy]");

  if (button) {
    copyText(button.dataset.copy);
  }
});

// =========================================================
// WCZYTYWANIE DANYCH
// =========================================================

Promise.all([
  fetch("pracownicy.json").then((r) => {
    if (!r.ok) {
      throw new Error("Nie udało się pobrać bazy pracowników.");
    }

    return r.json();
  }),

  fetch("wydzialy.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []),
])
  .then(([employeeData, facultyData]) => {
    if (!Array.isArray(employeeData)) {
      throw new Error("Nieprawidłowy format bazy pracowników.");
    }

    employees = employeeData;
    faculties = Array.isArray(facultyData) ? facultyData : [];

    render(employees);
  })
  .catch(() => {
    countLabel.textContent =
      "Nie udało się wczytać bazy pracowników.";

    resultsContainer.innerHTML = `
      <div class="empty-state">
        <strong>Problem z wczytaniem danych</strong>
        Sprawdź, czy pliki pracownicy.json i wydzialy.json
        znajdują się w odpowiednim katalogu.
      </div>`;
  });

// =========================================================
// OBSŁUGA WYSZUKIWARKI I PRZYCISKU WYCZYŚĆ
// =========================================================

searchInput.addEventListener("input", filterEmployees);

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  filterEmployees();
  searchInput.focus();
});