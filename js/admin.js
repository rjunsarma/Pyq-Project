const container = document.getElementById("papers");

/* ================================
   LOAD PENDING
================================ */
async function loadPending() {
    setActive("pending-btn");
    document.getElementById("admin-heading").innerText = "Pending Uploads";

    const res = await fetch("/api/upload/pending");
    const data = await res.json();
    renderList(data, "pending");
}

async function loadApproved() {
    setActive("approved-btn");
    document.getElementById("admin-heading").innerText = "Approved Uploads";

    const res = await fetch("/api/upload/approved");
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
                <a href="${paper.file_url}" target="_blank">View PDF</a>
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
    const res = await fetch(`/api/upload/approve/${id}`, { method: "POST" });
    const result = await res.json();

    if (!res.ok) {
        alert(result.error || "Failed to approve paper");
        return;
    }

    alert("Paper approved");
    loadPending();
}

async function rejectPaper(id) {
    const res = await fetch(`/api/upload/reject/${id}`, { method: "POST" });
    const result = await res.json();

    if (!res.ok) {
        alert(result.error || "Failed to reject paper");
        return;
    }

    alert("Paper rejected");
    loadPending();
}

async function deletePaper(id) {
    const ok = confirm("Delete this paper permanently?\nThis cannot be undone.");
    if (!ok) return;

    const res = await fetch(`/api/upload/delete/${id}`, { method: "DELETE" });
    const result = await res.json();

    if (!res.ok) {
        alert(result.error || "Failed to delete paper");
        return;
    }

    alert("Paper deleted");
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
loadPending();
