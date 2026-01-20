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
                alert(result.error || "Upload failed. Please try again.");
                return;
            }

            popup.classList.remove("hidden");
            form.reset();

        } catch (err) {
            alert("Unable to upload at the moment. Please try again later.");
            console.error(err);
        }
    });

    closeBtn.addEventListener("click", () => {
        popup.classList.add("hidden");
    });
});
