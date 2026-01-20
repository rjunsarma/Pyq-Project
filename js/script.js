/* ================================
   GLOBAL STATE
================================ */
let currentCategory = null;
let approvedPapers = [];

// Elements
const content = document.getElementById("content");
const title = document.getElementById("section-title");
const filterBar = document.getElementById("filter-bar");

const searchInput = document.getElementById("search-input");
const semesterFilter = document.getElementById("semester-filter");
const yearFilter = document.getElementById("year-filter");

/* ================================
   FETCH APPROVED PAPERS (ONCE)
================================ */
async function fetchApprovedPapers() {
    try {
        const res = await fetch("/api/upload/approved");
        approvedPapers = await res.json();
    } catch (err) {
        console.error("Error fetching papers:", err);
        approvedPapers = [];
    }
}

/* ================================
   APPLY FILTERS
================================ */
function getFilteredPapers() {
    if (!currentCategory) return [];

    const searchText = searchInput.value.toLowerCase();
    const semesterValue = semesterFilter.value;
    const yearValue = yearFilter.value.trim();

    return approvedPapers.filter(paper => {
        if (paper.category.toLowerCase() !== currentCategory.toLowerCase()) return false;
        if (searchText && !paper.subject.toLowerCase().includes(searchText)) return false;
        if (semesterValue && String(paper.semester) !== semesterValue) return false;
        if (yearValue && paper.year !== yearValue) return false;
        return true;
    });
}

/* ================================
   RENDER PAPERS
================================ */
function renderPapers() {
    content.innerHTML = "";

    const filtered = getFilteredPapers();

    if (filtered.length === 0) {
        content.innerHTML = `
            <div class="no-results">
                <h3>🔍 No matching papers found</h3>
                <p>Try changing or clearing filters.</p>
            </div>
        `;
        return;
    }

    // Group by subject
    const grouped = {};
    filtered.forEach(paper => {
        if (!grouped[paper.subject]) grouped[paper.subject] = [];
        grouped[paper.subject].push(paper);
    });

    // Render cards
    for (const subject in grouped) {
        const card = document.createElement("div");
        card.className = "card";

        let html = `<h3>${subject}</h3>`;

        grouped[subject].forEach(paper => {
            html += `
                <a href="${paper.fileUrl}" download>
                    Semester ${paper.semester} – ${paper.year}
                </a>
            `;
        });

        card.innerHTML = html;
        content.appendChild(card);
    }
}

/* ================================
   CATEGORY HANDLER
================================ */
async function loadCategory(category) {
    if (approvedPapers.length === 0) {
        await fetchApprovedPapers();
    }

    currentCategory = category;

    title.classList.remove("hidden");
    content.classList.remove("hidden");
    filterBar.classList.remove("hidden");

    title.innerText = category.toUpperCase() + " – Available Papers";

    renderPapers();

    setTimeout(() => {
        title.scrollIntoView({ behavior: "smooth" });
    }, 100);
}

/* ================================
   FILTER LISTENERS (THIS WAS MISSING)
================================ */
[searchInput, semesterFilter, yearFilter].forEach(el => {
    el.addEventListener("input", () => {
        if (currentCategory) {
            renderPapers();
        }
    });
});

/* ================================
   HERO VIDEO
================================ */
const hero = document.querySelector(".hero");
const video = document.querySelector(".bg-video");

if (hero && video) {
    hero.addEventListener("mouseenter", () => video.play().catch(() => {}));
    hero.addEventListener("mouseleave", () => video.pause());
}

/* ================================
   BROWSE CTA
================================ */
const browseCTA = document.getElementById("browse-cta");
const browseMenu = document.getElementById("browse-menu");
const categorySection = document.getElementById("categories");

function showCategories() {
    categorySection.classList.remove("hidden");
    categorySection.scrollIntoView({ behavior: "smooth" });
}

if (browseCTA) browseCTA.addEventListener("click", showCategories);
if (browseMenu) browseMenu.addEventListener("click", e => {
    e.preventDefault();
    showCategories();
});
