const container = document.getElementById("papers");

/* ================================
   LOAD PENDING
================================ */
async function loadPending() {
    setActive("pending-btn");

    // ✅ Update heading
    document.getElementById("admin-heading").innerText = "Pending Uploads";

    const res = await fetch("http://localhost:5000/api/upload/pending");
    const data = await res.json();
    renderList(data, "pending");
}

async function loadApproved() {
    setActive("approved-btn");

    // ✅ Update heading
    document.getElementById("admin-heading").innerText = "Approved Uploads";

    const res = await fetch("http://localhost:5000/api/upload/approved");
    const data = await res.json();
    renderList(data, "approved");
}


/* ================================
   RENDER LIST
================================ */
function renderList(data, mode) {
    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.innerHTML = "<p>No papers found.</p>";
        return;
    }

    data.forEach(paper => {
        const div = document.createElement("div");
        div.className = "paper";

        const actions = mode === "pending"
            ? `
                <button class="approve" onclick="approvePaper('${paper.id}')">Approve</button>
                <button class="reject" onclick="rejectPaper('${paper.id}')">Reject</button>
              `
            : `
                <button class="delete" onclick="deletePaper('${paper.id}')">Delete</button>
              `;

        div.innerHTML = `
            <div class="info">
                <p><strong>${paper.subject}</strong> (${paper.category.toUpperCase()})</p>
                <p>Semester: ${paper.semester} | Year: ${paper.year}</p>
            </div>
            <div class="actions">
                ${actions}
            </div>
        `;

        container.appendChild(div);
    });
}

/* ================================
   ACTIONS
================================ */
async function approvePaper(id) {
    await fetch(`http://localhost:5000/api/upload/approve/${id}`, { method: "POST" });
    loadPending();
}

async function rejectPaper(id) {
    await fetch(`http://localhost:5000/api/upload/reject/${id}`, { method: "POST" });
    loadPending();
}

async function deletePaper(id) {
    const ok = confirm("Delete this paper permanently?\nThis cannot be undone.");
    if (!ok) return;

    await fetch(`http://localhost:5000/api/upload/delete/${id}`, {
        method: "DELETE"
    });

    loadApproved();
}

/* ================================
   ACTIVE BUTTON STATE
================================ */
function setActive(buttonId) {
    const pendingBtn = document.getElementById("pending-btn");
    const approvedBtn = document.getElementById("approved-btn");

    if (!pendingBtn || !approvedBtn) return;

    pendingBtn.classList.remove("active");
    approvedBtn.classList.remove("active");

    document.getElementById(buttonId).classList.add("active");
}

/* ================================
   INITIAL LOAD
================================ */
// Load pending WITHOUT setting active state
fetch("http://localhost:5000/api/upload/pending")
    .then(res => res.json())
    .then(data => renderList(data, "pending"));

