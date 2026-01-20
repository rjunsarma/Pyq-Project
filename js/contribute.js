document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("upload-form");
    const popup = document.getElementById("success-popup");
    const closeBtn = document.getElementById("close-popup");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData(form);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                alert(result.error || "Upload failed");
                return;
            }

            popup.classList.remove("hidden");
            form.reset();

        } catch (err) {
            alert("Unable to connect to the server. Please try again later.");
            console.error("Upload error:", err);
        }
    });

    closeBtn.addEventListener("click", () => {
        popup.classList.add("hidden");
    });
});
