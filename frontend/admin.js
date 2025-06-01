document.addEventListener("DOMContentLoaded", function () {
  const mainContent = document.getElementById("main-content");
  const navLinks = document.querySelectorAll(".sidebar nav a");

  // Helper to clear active class and set active on clicked link
  function setActiveLink(clickedLink) {
    navLinks.forEach((link) => link.classList.remove("active"));
    clickedLink.classList.add("active");
  }

  // Helper functions
  function showError(element, message) {
    element.textContent = message;
    element.style.color = "red";
  }

  function showSuccess(element, message) {
    element.textContent = message;
    element.style.color = "green";
  }

  function handleUploadError(element, message, statusCode) {
    if (statusCode === 401) {
      localStorage.removeItem("access_token");
      message = "Session expired. Please login again.";
    }
    showError(element, message);

    // Hide progress bar on error
    document.getElementById("uploadProgress").style.display = "none";
  }

  function isTokenValid(token) {
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  // Load views content
  async function loadView(view) {
    switch (view) {
      case "upload":
        mainContent.innerHTML = `
          <h1>Upload Sales Data</h1>
          <form id="uploadForm">
            <div class="form-group">
              <label for="salesFile">Select sales data file (CSV or JSON):</label>
              <input type="file" id="salesFile" name="salesFile" accept=".csv,application/json" required />
            </div>
            <button type="submit">Upload</button>
            <p id="uploadStatus"></p>
          </form>
        `;
        document
          .getElementById("uploadForm")
          .addEventListener("submit", async (e) => {
            e.preventDefault();

            const fileInput = document.getElementById("salesFile");
            const status = document.getElementById("uploadStatus");
            const submitButton = document.querySelector(
              '#uploadForm button[type="submit"]'
            );

            // Reset UI state
            status.textContent = "";
            status.style.color = "black";

            // Validate file
            if (fileInput.files.length === 0) {
              showError(status, "Please select a file to upload.");
              return;
            }

            const file = fileInput.files[0];

            // File validation
            if (!file.name.endsWith(".csv")) {
              showError(status, "Only CSV files are allowed.");
              return;
            }

            if (file.size > 5 * 1024 * 1024) {
              // 5MB limit
              showError(status, "File size must be less than 5MB.");
              return;
            }

            // Get and validate token
            const token = localStorage.getItem("access_token");
            if (!token || !isTokenValid(token)) {
              showError(
                status,
                "Please login first (invalid or expired token)."
              );
              localStorage.removeItem("access_token");
              return;
            }

            // Prepare upload
            status.textContent = "Uploading file...";
            submitButton.disabled = true;
            const formData = new FormData();
            formData.append("file", file);

            try {
              const response = await fetch(
                "http://localhost:8000/upload-sales",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                  body: formData,
                  credentials: "include", // Important for cookies/sessions
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Upload failed");
              }

              const data = await response.json();
              showSuccess(status, "Upload successful: " + (data.message || ""));
              fileInput.value = "";
            } catch (error) {
              handleUploadError(status, error.message);

              // If token is invalid/expired, remove it
              if (
                error.message.includes("token") ||
                error.message.includes("authenticate")
              ) {
                localStorage.removeItem("access_token");
              }
            } finally {
              submitButton.disabled = false;
            }
          });
        break;

      case "summary":
        mainContent.innerHTML = `
  <h1>Analytics Summary</h1>
  <div class="chart-container" style="max-width: 600px; margin: 0 auto;">
    <canvas id="summaryPieChart" width="400" height="400"></canvas>
  </div>
`;

        try {
          const token = localStorage.getItem("access_token");

          const res = await fetch("http://localhost:8000/analytics/summary", {
            headers: {
              Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            },
          });
          if (!res.ok) throw new Error("Failed to fetch summary");
          const data = await res.json();

         const ctx = document.getElementById("summaryPieChart").getContext("2d");
new Chart(ctx, {
  type: "bar",
  data: {
    labels: ["Metrics"],
    datasets: [
      {
        label: "Total Sales ($)",
        data: [data.totalSales],
        backgroundColor: "#4CAF50",
        yAxisID: "y",
      },
      {
        label: "Total Transactions",
        data: [data.totalTransactions],
        backgroundColor: "#2196F3",
        yAxisID: "y1",
      },
      {
        label: "Avg Order Value ($)",
        data: [data.averageOrderValue],
        backgroundColor: "#FF9800",
        yAxisID: "y2",
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        title: { display: true, text: "Total Sales ($)" },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        title: { display: true, text: "Total Transactions" },
        grid: { drawOnChartArea: false },
      },
      y2: {
        type: "linear",
        display: true,
        position: "right",
        title: { display: true, text: "Avg Order Value ($)" },
        grid: { drawOnChartArea: false },
      },
    },
  },
});
        } catch (err) {
          mainContent.innerHTML = `<p>Error loading summary chart: ${err.message}</p>`;
        }
        break;

      case "top-customers":
        mainContent.innerHTML = `
  <section style="margin-top: 40px;">
    <h2 style="font-size: 1.5rem; color: #333;">🏆 Top 3 Customers by Sales</h2>
    <canvas id="topCustomersChart" height="150"></canvas>
  </section>
`;

        async function renderTop3Customers() {
          try {
            const token = localStorage.getItem("access_token");

            const res = await fetch(
              "http://localhost:8000/analytics/top-customers",
              {
                headers: {
                  Authorization: `Bearer ${token}`, // Include the token in the Authorization header
                },
              }
            );
            if (!res.ok) throw new Error("Failed to fetch top customers");
            const data = await res.json();

            const labels = data.map((c) => c.customer_name);
            const sales = data.map((c) => c.total_sales);

            const ctx = document
              .getElementById("topCustomersChart")
              .getContext("2d");
            new Chart(ctx, {
              type: "bar",
              data: {
                labels,
                datasets: [
                  {
                    label: "Sales ($)",
                    data: sales,
                    backgroundColor: ["#6A5ACD", "#20B2AA", "#FFA07A"],
                    borderRadius: 8,
                    barThickness: 50,
                  },
                ],
              },
              options: {
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (context) => `$${context.raw.toFixed(2)}`,
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (val) => `$${val}`,
                      color: "#888",
                    },
                    grid: { color: "#eee" },
                  },
                  x: {
                    ticks: { color: "#444" },
                    grid: { display: false },
                  },
                },
              },
            });
          } catch (err) {
            console.error("Chart error:", err);
            mainContent.innerHTML += `<p style="color:red;">Unable to load top customers chart.</p>`;
          }
        }

        renderTop3Customers();

        break;

      case "by-date":
        mainContent.innerHTML = `
          <h1>Analytics By Date Range</h1>
          <form id="dateRangeForm">
            <div class="form-group">
              <label for="fromDate">From:</label>
              <input type="date" id="fromDate" name="fromDate" required />
            </div>
            <div class="form-group">
              <label for="toDate">To:</label>
              <input type="date" id="toDate" name="toDate" required />
            </div>
            <button type="submit">Get Analytics</button>
          </form>
          <div id="dateRangeResults"></div>
        `;
        document
          .getElementById("dateRangeForm")
          .addEventListener("submit", async (e) => {
            e.preventDefault();
            const from = document.getElementById("fromDate").value;
            const to = document.getElementById("toDate").value;
            const resultsDiv = document.getElementById("dateRangeResults");
            if (!from || !to) {
              resultsDiv.innerHTML = "<p>Please select both dates.</p>";
              return;
            }
            resultsDiv.innerHTML = "<p>Loading analytics...</p>";
            try {
              const token = localStorage.getItem("access_token");

              const res = await fetch(
                `http://localhost:8000/analytics/by-date?from=${encodeURIComponent(
                  from
                )}&to=${encodeURIComponent(to)}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`, // Include the token in the Authorization header
                  },
                }
              );
              if (!res.ok) throw new Error("Failed to fetch analytics by date");
              const data = await res.json();
              resultsDiv.innerHTML = `
              <ul>
                <li><strong>Total Sales:</strong> $${data.totalSales.toFixed(
                  2
                )}</li>
                <li><strong>Total Transactions:</strong> ${
                  data.totalTransactions
                }</li>
                <li><strong>Average Order Value:</strong> $${data.averageOrderValue.toFixed(
                  2
                )}</li>
              </ul>
            `;
            } catch (err) {
              resultsDiv.innerHTML = `<p>Error: ${err.message}</p>`;
            }
          });
        break;

      default:
        mainContent.innerHTML = `
          <h1>Welcome to the Admin Dashboard</h1>
          <p>Select an option from the sidebar to manage your application.</p>
        `;
    }
  }

  // Setup sidebar navigation click handlers
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");
      setActiveLink(link);
      loadView(view);
    });
  });

  // Initial load (load upload view)
  loadView("summary");
});
