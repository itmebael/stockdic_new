
"use strict";

/* ==========================================================
   AVENTUS MEDICAL INC. — REQUEST ITEM DASHBOARD
   File: request-dashboard.js
   ========================================================== */

/* SUPABASE CONFIGURATION */

const SUPABASE_URL =
  "https://yuxbqwnltundwxcofsgd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_3VaLSWayLHoB_moqO_Igbw_obf6bU7P";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* CLINIC CONFIGURATION */

const CLINICS = {
  pasay: {
    name: "Pasay Clinic",
    table: "psy_stock",
    requestClinicId: "pasay"
  },

  ane: {
    name: "ANE Clinic",
    table: "ane_stock",

    // The existing clinics table uses "ani" for ANE.
    requestClinicId: "ani"
  },

  manila: {
    name: "Manila Clinic",
    table: "mnl_stock",
    requestClinicId: "manila"
  }
};

/* APPLICATION STATE */

const state = {
  clinic: "pasay",
  page: "dashboard",
  stock: [],
  departments: [],
  requestBox: [],
  requests: [],
  analytics: []
};

let quantityItemId = null;

const $ = (id) => document.getElementById(id);

function clinicConfig() {
  return CLINICS[state.clinic];
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function toNumber(value) {
  return Number(value ?? 0);
}

function formatQuantity(value) {
  return toNumber(value).toLocaleString("en-PH", {
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showMessage(message, isError = false) {
  const element = $("requestMessage");

  element.textContent = message;

  element.className =
    "form-message " + (isError ? "error" : "success");
}

function showError(error) {
  console.error(error);

  showMessage(
    error?.message || String(error),
    true
  );
}

function normalizeStock(row) {
  return {
    id: row.id,
    code: row.item_id || "",
    name: row.description || "Unnamed Item",
    category: row.category || "Uncategorized",
    unit: row.unit || "PCS",
    balance: toNumber(row.ending_quantity),
    price: toNumber(row.unit_price)
  };
}

/* ==========================================================
   NAVIGATION
   ========================================================== */

function navigate(page) {
  state.page = page;

  document.querySelectorAll(".page").forEach(
    (element) => {
      element.classList.toggle(
        "active",
        element.id === page + "Page"
      );
    }
  );

  document.querySelectorAll(".nav-btn").forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    }
  );

  const pageTitles = {
    dashboard: "Request Dashboard",
    requests: "Request Items",
    analytics: "Analytics & Reports",
    configuration: "Configuration",
    audit: "Stock Audit"
  };

  $("pageTitle").textContent =
    pageTitles[page] || "Request Dashboard";

  $("sidebar").classList.remove("open");

  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "requests") {
    loadStock();
    loadDepartments();
  }

  if (page === "analytics") {
    loadAnalytics();
  }

  if (page === "audit") {
    loadStock();
  }
}

document.querySelectorAll(".nav-btn").forEach(
  (button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.page);
    });
  }
);

$("menuToggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

$("openNewRequest").addEventListener("click", () => {
  navigate("requests");
});

$("backToRequests").addEventListener("click", () => {
  navigate("dashboard");
});

$("clinicSelect").addEventListener(
  "change",
  async (event) => {
    state.clinic = event.target.value;

    state.stock = [];
    state.requestBox = [];

    closeRequestPreview();
    $("requestBox").hidden = true;
    $("toggleRequestBox").setAttribute("aria-expanded", "false");

    renderRequestBox();

    await Promise.all([
      loadStock(),
      loadDepartments()
    ]);

    navigate(state.page);
  }
);

/* ==========================================================
   LOAD CLINIC INVENTORY
   ========================================================== */

async function loadStock() {
  const clinicAtStart = state.clinic;

  const table = clinicConfig().table;

  const allRows = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const { data, error } = await db
      .from(table)
      .select(
        "id,item_id,description,category,unit," +
        "ending_quantity,unit_price"
      )
      .order("id", {
        ascending: true
      })
      .range(
        from,
        from + pageSize - 1
      );

    if (error) {
      showError(error);
      return;
    }

    allRows.push(...data);

    if (data.length < pageSize) {
      break;
    }
  }

  if (state.clinic !== clinicAtStart) {
    return;
  }

  state.stock = allRows.map(normalizeStock);

  renderStock();
  renderAudit();
}

/* ==========================================================
   ITEM GRID
   ========================================================== */

function renderStock() {
  const search = $("itemSearch")
    .value
    .trim()
    .toLowerCase();

  const selectedCategory =
    $("categorySelect").value;

  const categories = [
    ...new Set(
      state.stock.map(
        (item) => item.category
      )
    )
  ].sort();

  $("categorySelect").innerHTML =
    '<option value="">All categories</option>' +
    categories.map((category) => `
      <option value="${escapeHTML(category)}">
        ${escapeHTML(category)}
      </option>
    `).join("");

  $("categorySelect").value =
    categories.includes(selectedCategory)
      ? selectedCategory
      : "";

  const activeCategory =
    $("categorySelect").value;

  const filtered = state.stock.filter(
    (item) => {
      const categoryMatches =
        !activeCategory ||
        item.category === activeCategory;

      const searchMatches =
        `${item.name} ${item.code}`
          .toLowerCase()
          .includes(search);

      return categoryMatches && searchMatches;
    }
  );

  $("itemCount").textContent =
    `${filtered.length} items`;

  if (!filtered.length) {
    $("itemGrid").innerHTML =
      "<p>No matching items found.</p>";

    return;
  }

  $("itemGrid").innerHTML = filtered.map(
    (item) => `
      <button
        type="button"
        class="item-card"
        data-add-item="${item.id}"
        ${item.balance <= 0 ? "disabled" : ""}
      >
        <span class="item-category">
          ${escapeHTML(item.category)}
        </span>

        <h4>
          ${escapeHTML(item.name)}
        </h4>

        <span class="item-unit">
          ${escapeHTML(item.unit)}
        </span>

        <span class="stock-badge ${
          item.balance <= 0 ? "out" : ""
        }">
          ${
            item.balance <= 0
              ? "OUT OF STOCK"
              : formatQuantity(item.balance) +
                " IN STOCK"
          }
        </span>
      </button>
    `
  ).join("");
}

$("itemGrid").addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "[data-add-item]"
    );

    if (!button) {
      return;
    }

    openQuantityDialog(Number(button.dataset.addItem));
  }
);

$("itemSearch").addEventListener(
  "input",
  renderStock
);

$("categorySelect").addEventListener(
  "change",
  renderStock
);

/* ==========================================================
   LOAD DEPARTMENTS
   ========================================================== */

async function loadDepartments() {
  const clinicAtStart = state.clinic;

  const { data, error } = await db
    .from("departments")
    .select("id,name,clinic_id")
    .eq(
      "clinic_id",
      clinicConfig().requestClinicId
    )
    .order("name");

  if (error) {
    showError(error);
    return;
  }

  if (state.clinic !== clinicAtStart) {
    return;
  }

  state.departments = data;

  $("departmentSelect").innerHTML =
    '<option value="">Select department</option>' +
    data.map((department) => `
      <option value="${department.id}">
        ${escapeHTML(department.name)}
      </option>
    `).join("");
}

/* ==========================================================
   REQUEST BOX
   ========================================================== */

function openQuantityDialog(itemId) {
  const item = state.stock.find((entry) => entry.id === itemId);
  if (!item) return;

  quantityItemId = itemId;
  const existing = state.requestBox.find((entry) => entry.id === itemId);
  $("quantityItemName").textContent = item.name;
  $("quantityItemDetails").textContent =
    `${item.category} · ${item.unit} · ${formatQuantity(item.balance)} available`;
  $("requestQuantity").max = item.balance;
  $("requestQuantity").value = existing?.quantity || 1;
  $("quantityModal").hidden = false;
  $("requestQuantity").focus();
  $("requestQuantity").select();
}

function addToRequestBox(itemId, quantity) {
  const item = state.stock.find(
    (entry) => entry.id === itemId
  );

  if (!item) {
    return;
  }

  const existing = state.requestBox.find(
    (entry) => entry.id === itemId
  );

  const nextQuantity = quantity;

  if (nextQuantity > item.balance) {
    showMessage(
      `Insufficient stock for ${item.name}. ` +
      `Available: ${formatQuantity(item.balance)}.`,
      true
    );

    return;
  }

  if (existing) {
    existing.quantity = nextQuantity;
  } else {
    state.requestBox.push({
      id: item.id,
      quantity
    });
  }

  renderRequestBox();

  showMessage(
    `${item.name} added to the request box.`
  );
}

function changeRequestQuantity(
  itemId,
  delta
) {
  const entry = state.requestBox.find(
    (item) => item.id === itemId
  );

  const stockItem = state.stock.find(
    (item) => item.id === itemId
  );

  if (!entry || !stockItem) {
    return;
  }

  const nextQuantity =
    entry.quantity + delta;

  if (nextQuantity <= 0) {
    state.requestBox =
      state.requestBox.filter(
        (item) => item.id !== itemId
      );

  } else if (
    nextQuantity > stockItem.balance
  ) {
    showMessage(
      `You cannot request more than ` +
      `${formatQuantity(stockItem.balance)} ` +
      `${stockItem.unit}.`,
      true
    );

    return;

  } else {
    entry.quantity = nextQuantity;
  }

  renderRequestBox();
}

function renderRequestBox() {
  $("boxCount").textContent =
    state.requestBox.length;

  if (!state.requestBox.length) {
    $("requestBoxItems").innerHTML =
      "<p>No items selected.</p>";

    return;
  }

  $("requestBoxItems").innerHTML =
    state.requestBox.map((entry) => {
      const item = state.stock.find(
        (stock) => stock.id === entry.id
      );

      if (!item) {
        return "";
      }

      return `
        <div class="request-box-item">
          <div class="request-box-item-name">
            ${escapeHTML(item.name)}

            <br>

            <small>
              ${escapeHTML(item.unit)} ·
              Available:
              ${formatQuantity(item.balance)}
            </small>
          </div>

          <div class="quantity-controls">
            <button
              type="button"
              data-change-id="${item.id}"
              data-delta="-1"
            >
              −
            </button>

            <span>
              ${entry.quantity}
            </span>

            <button
              type="button"
              data-change-id="${item.id}"
              data-delta="1"
            >
              +
            </button>

            <button
              type="button"
              data-remove-id="${item.id}"
              aria-label="Remove item"
            >
              ×
            </button>
          </div>
        </div>
      `;
    }).join("");
}

$("requestBoxItems").addEventListener(
  "click",
  (event) => {
    const changeButton =
      event.target.closest(
        "[data-change-id]"
      );

    if (changeButton) {
      changeRequestQuantity(
        Number(
          changeButton.dataset.changeId
        ),
        Number(
          changeButton.dataset.delta
        )
      );

      return;
    }

    const removeButton =
      event.target.closest(
        "[data-remove-id]"
      );

    if (removeButton) {
      const id = Number(
        removeButton.dataset.removeId
      );

      state.requestBox =
        state.requestBox.filter(
          (entry) => entry.id !== id
        );

      renderRequestBox();
    }
  }
);

$("toggleRequestBox").addEventListener(
  "click",
  () => {
    $("requestBox").hidden =
      !$("requestBox").hidden;
    $("toggleRequestBox").setAttribute(
      "aria-expanded",
      String(!$("requestBox").hidden)
    );
  }
);

/* ==========================================================
   SAVE REQUEST
   ========================================================== */

function createReference() {
  const date = new Date();

  const datePart = [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("");

  const randomPart =
    crypto.randomUUID()
      .slice(0, 8)
      .toUpperCase();

  return `REQ-${datePart}-${randomPart}`;
}

async function saveRequest() {
  const departmentId = Number(
    $("departmentSelect").value
  );

  const receiverName =
    $("receiverName").value.trim();

  const remarks =
    $("requestRemarks").value.trim();

  if (!departmentId) {
    showMessage(
      "Please select a department.",
      true
    );

    return;
  }

  if (!receiverName) {
    showMessage(
      "Please enter the receiver's name.",
      true
    );

    return;
  }

  if (!state.requestBox.length) {
    showMessage(
      "Please select at least one item.",
      true
    );

    return;
  }

  const selectedClinic = state.clinic;

  const clinic = clinicConfig();

  const selectedItems =
    state.requestBox.map((item) => ({
      ...item
    }));

  const saveButton = $("confirmSaveRequest");

  saveButton.disabled = true;

    saveButton.textContent = "Saving...";

  try {
    const { data: currentStock, error: stockError } =
      await db
        .from(clinic.table)
        .select(
          "id,ending_quantity"
        )
        .in(
          "id",
          selectedItems.map(
            (item) => item.id
          )
        );

    if (stockError) {
      throw stockError;
    }

    for (const entry of selectedItems) {
      const current = currentStock.find(
        (item) => item.id === entry.id
      );

      if (!current) {
        throw new Error(
          `Item ${entry.id} no longer exists.`
        );
      }

      if (
        entry.quantity >
        toNumber(current.ending_quantity)
      ) {
        throw new Error(
          `Item ${entry.id} has insufficient stock. ` +
          `Available: ${formatQuantity(
            current.ending_quantity
          )}.`
        );
      }
    }

    if (state.clinic !== selectedClinic) {
      throw new Error(
        "The selected clinic changed while saving."
      );
    }

    const { data: request, error: requestError } =
      await db
        .from("department_requests")
        .insert({
          clinic_id:
            clinic.requestClinicId,

          department_id:
            departmentId,

          reference_number:
            createReference(),

          receiver_name:
            receiverName,

          remarks:
            remarks || null,

          status:
            "pending"
        })
        .select()
        .single();

    if (requestError) {
      throw requestError;
    }

    const requestItems =
      selectedItems.map((entry) => {
        const stockItem = state.stock.find(
          (item) => item.id === entry.id
        );

        return {
          request_id:
            request.id,

          stock_item_id:
            null,

          branch_stock_id:
            entry.id,

          clinic_id:
            clinic.requestClinicId,

          requested_quantity:
            entry.quantity,

          unit:
            stockItem.unit
        };
      });

    const { error: itemsError } = await db
      .from("request_items")
      .insert(requestItems);

    if (itemsError) {
      throw new Error(
        `Request header ${request.reference_number} ` +
        "was created, but its items could not be saved: " +
        itemsError.message +
        ". Contact the administrator before retrying."
      );
    }

    state.requestBox = [];

    renderRequestBox();

    closeRequestPreview();
    $("requestBox").hidden = true;
    $("toggleRequestBox").setAttribute("aria-expanded", "false");

    $("receiverName").value = "";

    $("requestRemarks").value = "";

    showMessage(
      `Request ${request.reference_number} ` +
      "saved successfully."
    );

    await openRequestReceipt(
      request.id
    );

  } catch (error) {
    showError(error);

  } finally {
    saveButton.disabled = false;

    saveButton.textContent =
      "Save Request";
  }
}

/* ==========================================================
   DASHBOARD
   ========================================================== */

async function loadDashboard() {
  const clinicId =
    clinicConfig().requestClinicId;

  const { data, error } = await db
    .from("department_requests")
    .select(
      "id,reference_number,department_id," +
      "receiver_name,status,created_at," +
      "departments(name)"
    )
    .eq(
      "clinic_id",
      clinicId
    )
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(1000);

  if (error) {
    console.error(error);

    $("recentRequestsBody").innerHTML = `
      <tr>
        <td colspan="5">
          ${escapeHTML(error.message)}
        </td>
      </tr>
    `;

    return;
  }

  state.requests = data;

  $("totalRequests").textContent =
    data.length;

  $("pendingRequests").textContent =
    data.filter(
      (request) =>
        request.status === "pending"
    ).length;

  $("completedRequests").textContent =
    data.filter(
      (request) =>
        request.status === "done"
    ).length;

  $("requestedItemTypes").textContent =
    "—";

  $("recentRequestsBody").innerHTML =
    data.length
      ? data.slice(0, 20).map(
        (request) => `
          <tr>
            <td>
              ${escapeHTML(
                request.reference_number
              )}
            </td>

            <td>
              ${escapeHTML(
                request.departments?.name || "—"
              )}
            </td>

            <td>
              ${escapeHTML(
                formatDate(
                  request.created_at
                )
              )}
            </td>

            <td>
              ${escapeHTML(
                request.status
              )}
            </td>

            <td>
              <button
                class="secondary-btn"
                data-receipt-id="${request.id}"
              >
                Receipt
              </button>
            </td>
          </tr>
        `
      ).join("")
      : `
        <tr>
          <td colspan="5">
            No requests found.
          </td>
        </tr>
      `;
}

$("recentRequestsBody").addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-receipt-id]"
      );

    if (!button) {
      return;
    }

    openRequestReceipt(
      Number(
        button.dataset.receiptId
      )
    );
  }
);

/* ==========================================================
   ANALYTICS
   ========================================================== */

async function loadAnalytics() {
  const clinicId =
    clinicConfig().requestClinicId;

  let query = db
    .from("request_items_analytics")
    .select("*")
    .eq(
      "clinic_id",
      clinicId
    )
    .order(
      "requested_at",
      {
        ascending: false
      }
    )
    .limit(1000);

  const dateFrom =
    $("reportDateFrom").value;

  const dateTo =
    $("reportDateTo").value;

  const status =
    $("reportStatus").value;

  if (dateFrom) {
    query = query.gte(
      "requested_at",
      `${dateFrom}T00:00:00`
    );
  }

  if (dateTo) {
    const nextDay = new Date(
      `${dateTo}T00:00:00`
    );

    nextDay.setDate(
      nextDay.getDate() + 1
    );

    query = query.lt(
      "requested_at",
      nextDay.toISOString()
    );
  }

  if (status) {
    query = query.eq(
      "status",
      status
    );
  }

  const { data, error } =
    await query;

  if (error) {
    console.error(error);
    $("reportCards").innerHTML = `<p class="report-error">${escapeHTML(error.message)}</p>`;
    return;
  }
  state.analytics = data;

  updateReportCategoryOptions();
  renderAnalytics();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function getFilteredAnalytics() {
  const search = $("reportSearch").value.trim().toLowerCase();
  const category = $("reportCategory").value;
  return state.analytics.filter((item) => {
    const searchable = `${item.item_name || ""} ${item.item_code || ""} ${item.reference_number || ""} ${item.department_name || ""}`.toLowerCase();
    return searchable.includes(search) &&
      (!category || (item.category || "Uncategorized") === category);
  });
}

function updateReportCategoryOptions() {
  const select = $("reportCategory");
  const selected = select.value;
  const categories = [...new Set(state.analytics.map((item) => item.category || "Uncategorized"))]
    .sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="">All categories</option>' + categories
    .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
    .join("");
  select.value = categories.includes(selected) ? selected : "";
}

function groupAnalyticsByCategory(rows) {
  const groups = new Map();
  rows.forEach((item) => {
    const category = item.category || "Uncategorized";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function analyticsItemAmount(item) {
  const price = toNumber(item.unit_price);
  if (!(price > 0)) return null;
  return toNumber(item.requested_amount) || toNumber(item.requested_quantity) * price;
}

function renderAnalytics() {
  const rows = getFilteredAnalytics();
  $("reportItemCount").textContent = rows.length;
  const completedQuantity = rows
    .filter((item) => item.status === "done")
    .reduce((total, item) => total + toNumber(item.requested_quantity), 0);
  $("reportCompletedQty").textContent = formatQuantity(completedQuantity);
  const pricedTotal = rows.reduce((total, item) => total + (analyticsItemAmount(item) ?? 0), 0);
  $("reportTotalAmount").textContent = formatMoney(pricedTotal);

  const groups = groupAnalyticsByCategory(rows);
  $("reportCards").innerHTML = groups.length ? groups.map(([category, items]) => {
    const categoryAmount = items.reduce((total, item) => total + (analyticsItemAmount(item) ?? 0), 0);
    const hasPrice = items.some((item) => analyticsItemAmount(item) !== null);
    return `
      <section class="report-category">
        <header class="report-category-heading">
          <div><span class="category-kicker">CATEGORY</span><h3>${escapeHTML(category)}</h3></div>
          <div class="category-heading-total"><span>${items.length} ${items.length === 1 ? "line" : "lines"}</span>${hasPrice ? `<strong>${formatMoney(categoryAmount)}</strong>` : ""}</div>
        </header>
        <div class="report-item-grid">
          ${items.map((item) => {
            const amount = analyticsItemAmount(item);
            return `
              <article class="report-item-card">
                <div class="report-item-topline"><span class="report-status status-${escapeHTML(item.status)}">${escapeHTML(item.status)}</span><time>${escapeHTML(formatDate(item.requested_at))}</time></div>
                <h4>${escapeHTML(item.item_name || "Unnamed item")}</h4>
                <p class="report-item-code">${escapeHTML(item.item_code || "No item code")}</p>
                <div class="report-item-details">
                  <span><small>REQUESTED BY</small><strong>${escapeHTML(item.department_name || "—")}</strong></span>
                  <span><small>REQUEST REF</small><strong>${escapeHTML(item.reference_number || "—")}</strong></span>
                  <span><small>QUANTITY</small><strong>${formatQuantity(item.requested_quantity)} ${escapeHTML(item.unit || "")}</strong></span>
                  ${amount !== null ? `<span><small>LINE AMOUNT</small><strong>${formatMoney(amount)}</strong></span>` : ""}
                </div>
                ${item.status === "pending" ? `<button type="button" class="approve-btn" data-approve-request="${Number(item.request_id)}">Approve request</button>` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("") : '<div class="report-empty"><strong>No matching requests</strong><span>Adjust the filters or search to see more results.</span></div>';
}
function closeQuantityDialog() {
  $("quantityModal").hidden = true;
  quantityItemId = null;
}

$("closeQuantity").addEventListener("click", closeQuantityDialog);
$("cancelQuantity").addEventListener("click", closeQuantityDialog);
$("quantityModal").addEventListener("click", (event) => {
  if (event.target === $("quantityModal")) closeQuantityDialog();
});
$("addQuantity").addEventListener("click", () => {
  const quantity = Number($("requestQuantity").value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    showMessage("Enter a quantity greater than zero.", true);
    return;
  }
  if (quantityItemId !== null) addToRequestBox(quantityItemId, quantity);
  if (!$("requestMessage").classList.contains("error")) closeQuantityDialog();
});
$("requestQuantity").addEventListener("keydown", (event) => {
  if (event.key === "Enter") $("addQuantity").click();
});

$("reportCards").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-approve-request]");
  if (!button) return;

  button.disabled = true;
  button.textContent = "Approving...";
  try {
    const { data, error } = await db
      .from("department_requests")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", Number(button.dataset.approveRequest))
      .eq("clinic_id", clinicConfig().requestClinicId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("This request is no longer pending or your account cannot approve it.");
    await loadAnalytics();
  } catch (error) {
    alert(`Could not approve the request: ${error.message}`);
    button.disabled = false;
    button.textContent = "Approve request";
  }
});
function openRequestPreview() {
  if (!state.requestBox.length) {
    showMessage("Please add at least one item to the box.", true);
    return;
  }
  const department = state.departments.find(
    (entry) => entry.id === Number($("departmentSelect").value)
  );
  const rows = state.requestBox.map((entry) => {
    const item = state.stock.find((stock) => stock.id === entry.id);
    return `<tr><td>${escapeHTML(item?.name || "Item")}</td><td>${escapeHTML(item?.unit || "")}</td><td>${formatQuantity(entry.quantity)}</td></tr>`;
  }).join("");
  $("requestPreviewContent").innerHTML = `
    <p><strong>Department:</strong> ${escapeHTML(department?.name || "Not selected")}</p>
    <p><strong>Receiver:</strong> ${escapeHTML($("receiverName").value.trim() || "Not entered")}</p>
    <div class="table-scroll"><table><thead><tr><th>Item</th><th>Unit</th><th>Quantity</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p><strong>Remarks:</strong> ${escapeHTML($("requestRemarks").value.trim() || "None")}</p>
  `;
  $("requestPreviewModal").hidden = false;
}

function closeRequestPreview() {
  $("requestPreviewModal").hidden = true;
}

$("previewRequest").addEventListener("click", openRequestPreview);
$("saveRequest").addEventListener("click", openRequestPreview);
$("closeRequestPreview").addEventListener("click", closeRequestPreview);
$("cancelPreview").addEventListener("click", closeRequestPreview);
$("cancelRequest").addEventListener("click", () => {
  state.requestBox = [];
  renderRequestBox();
  $("receiverName").value = "";
  $("requestRemarks").value = "";
  $("requestBox").hidden = true;
  $("toggleRequestBox").setAttribute("aria-expanded", "false");
  closeRequestPreview();
  showMessage("Request box cleared.");
});
$("confirmSaveRequest").addEventListener("click", saveRequest);

[
  "reportDateFrom",
  "reportDateTo",
  "reportStatus"
].forEach((id) => {
  $(id).addEventListener(
    "change",
    loadAnalytics
  );
});

$("reportSearch").addEventListener(
  "input",
  renderAnalytics
);

$("reportCategory").addEventListener("change", renderAnalytics);

$("printReport").addEventListener("click", () => {
  const rows = getFilteredAnalytics();
  if (!rows.length) {
    alert("There are no report rows to export with the current filters.");
    return;
  }

  const categoriesHTML = groupAnalyticsByCategory(rows).map(([category, items]) => {
    const pricedItems = items.filter((item) => analyticsItemAmount(item) !== null);
    const categoryTotal = pricedItems.reduce((total, item) => total + analyticsItemAmount(item), 0);
    const itemRows = items.map((item) => {
      const amount = analyticsItemAmount(item);
      return `<tr>
        <td>${escapeHTML(formatDate(item.requested_at))}</td>
        <td>${escapeHTML(item.reference_number || "")}</td>
        <td>${escapeHTML(item.department_name || "")}</td>
        <td>${escapeHTML(item.item_name || "")}</td>
        <td>${escapeHTML(item.unit || "")}</td>
        <td>${formatQuantity(item.requested_quantity)}</td>
        <td>${amount === null ? "—" : formatMoney(item.unit_price)}</td>
        <td>${amount === null ? "—" : formatMoney(amount)}</td>
        <td>${escapeHTML(item.status || "")}</td>
      </tr>`;
    }).join("");

    return `<section class="export-category">
      <h3>${escapeHTML(category)}</h3>
      <table><thead><tr><th>Date</th><th>Reference</th><th>Department</th><th>Item</th><th>Unit</th><th>Requested</th><th>Unit price</th><th>Amount</th><th>Status</th></tr></thead><tbody>${itemRows}</tbody></table>
      ${pricedItems.length ? `<p class="category-total">Category total: <strong>${formatMoney(categoryTotal)}</strong></p>` : ""}
    </section>`;
  }).join("");

  const pricedTotal = rows.reduce((total, item) => total + (analyticsItemAmount(item) ?? 0), 0);
  openPrintableHTML(`
    <h2>AVENTUS MEDICAL INC.</h2>
    <h3>REQUEST ITEM REPORT</h3>
    <p>${escapeHTML(clinicConfig().name)} · Printed ${escapeHTML(formatDate(new Date()))}</p>
    <p>${rows.length} request lines${pricedTotal ? ` · Priced request value ${formatMoney(pricedTotal)}` : ""}</p>
    ${categoriesHTML}
    <p>Completed request quantities are shown separately from verified consumption.</p>
    <style>.export-category{margin:24px 0;break-inside:avoid}.export-category h3{text-align:left;background:#eef3f8;padding:8px}.export-category table{font-size:9px}.category-total{text-align:right;margin:8px 0;font-size:13px}</style>
  `);
});
async function openRequestReceipt(
  requestId
) {
  const {
    data: request,
    error: requestError
  } = await db
    .from("department_requests")
    .select(
      "id,clinic_id,reference_number,status," +
      "receiver_name,remarks,created_at," +
      "departments(name)"
    )
    .eq(
      "id",
      requestId
    )
    .single();

  if (requestError) {
    alert(
      requestError.message
    );

    return;
  }

  const {
    data: items,
    error: itemsError
  } = await db
    .from("request_items_analytics")
    .select(
      "request_item_id,item_name,unit," +
      "requested_quantity"
    )
    .eq(
      "request_id",
      requestId
    )
    .order(
      "request_item_id"
    );

  if (itemsError) {
    alert(
      itemsError.message
    );

    return;
  }

  const clinicName =
    request.clinic_id === "pasay"
      ? "Pasay Clinic"
      : ["ane", "ani"].includes(
          request.clinic_id
        )
        ? "ANE Clinic"
        : "Manila Clinic";

  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        toNumber(
          item.requested_quantity
        ),
      0
    );

  $("receiptPrintArea").classList.remove("audit-print");
  $("receiptPrintArea").innerHTML = `
    <div class="receipt-title">
      AVENTUS MEDICAL INC.

      <br>

      ${escapeHTML(
        clinicName
      )}

      <br>

      STOCK REQUEST RECEIPT
    </div>

    <div class="receipt-divider">
    </div>

    <div>
      Req:
      ${escapeHTML(
        request.reference_number
      )}
    </div>

    <div>
      Dept:
      ${escapeHTML(
        request.departments?.name || "—"
      )}
    </div>

    <div>
      Date:
      ${escapeHTML(
        formatDate(
          request.created_at
        )
      )}
    </div>

    <div>
      Status:
      ${escapeHTML(
        request.status.toUpperCase()
      )}
    </div>

    <div class="receipt-divider">
    </div>

    <div class="receipt-row">
      <strong>ITEM</strong>
      <strong>QTY</strong>
    </div>

    <div class="receipt-divider">
    </div>

    ${items.map(
      (item) => `
        <div class="receipt-row">
          <span>
            ${escapeHTML(
              item.item_name
            )}

            <br>

            ${escapeHTML(
              item.unit
            )}
          </span>

          <strong>
            ${formatQuantity(
              item.requested_quantity
            )}
          </strong>
        </div>
      `
    ).join("")}

    <div class="receipt-divider">
    </div>

    <strong>
      Total:
      ${formatQuantity(
        totalQuantity
      )}
    </strong>

    <div style="margin-top: 12px;">
      Receiver:
      ${escapeHTML(
        request.receiver_name || "—"
      )}
    </div>

    <div class="receipt-signature">
      Stock Clerk Signature
    </div>

    <div class="receipt-signature">
      Receiver Signature
    </div>

    <div style="margin-top: 15px;">
      Encoded by Stock Clerk
    </div>
  `;

  $("receiptPrintArea").dataset.imageFilename =
    `request-${request.reference_number}`;

  $("receiptModal").hidden =
    false;
}

$("closeReceipt").addEventListener(
  "click",
  () => {
    $("receiptModal").hidden =
      true;
  }
);

$("printReceipt").addEventListener(
  "click",
  () => {
    window.print();
  }
);

$("saveReceiptImage").addEventListener("click", async () => {
  if (typeof window.html2canvas !== "function") {
    alert("Image export is unavailable. Check your internet connection and try again.");
    return;
  }
  const button = $("saveReceiptImage");
  button.disabled = true;
  button.textContent = "Preparing Image…";
  try {
    const canvas = await window.html2canvas($("receiptPrintArea"), {
      backgroundColor: "#ffffff",
      scale: 2
    });
    const link = document.createElement("a");
    link.download = `${$("receiptPrintArea").dataset.imageFilename || "receipt"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    alert(`Could not save the receipt image: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Save Receipt as Image";
  }
});

/* ==========================================================
   STOCK AUDIT
   ========================================================== */

function renderAudit() {
  $("auditGrid").innerHTML =
    state.stock.length
      ? state.stock.map(
        (item) => `
          <article class="item-card">
            <span class="item-category">
              ${escapeHTML(
                item.category
              )}
            </span>

            <h4>
              ${escapeHTML(
                item.name
              )}
            </h4>

            <span class="item-unit">
              ${escapeHTML(
                item.unit
              )}
            </span>

            <span class="stock-badge">
              Balance:
              ${formatQuantity(
                item.balance
              )}
            </span>

            <button
              class="primary-btn"
              data-audit-id="${item.id}"
            >
              Small Print
            </button>
          </article>
        `
      ).join("")
      : `
        <p>
          No inventory items found.
        </p>
      `;
}

$("auditGrid").addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-audit-id]"
      );

    if (!button) {
      return;
    }

    const item =
      state.stock.find(
        (entry) =>
          entry.id === Number(
            button.dataset.auditId
          )
      );

    if (!item) {
      return;
    }

    $("receiptPrintArea").classList.add("audit-print");
    $("receiptPrintArea").innerHTML = `
      <div class="receipt-title">
        AVENTUS MEDICAL INC.

        <br>

        STOCK AUDIT
      </div>

      <div class="receipt-divider">
      </div>

      <div>
        Name:
        ${escapeHTML(
          item.name
        )}
      </div>

      <div>
        Unit:
        ${escapeHTML(
          item.unit
        )}
      </div>

      <div>
        Balance:
        ${formatQuantity(
          item.balance
        )}
      </div>

      <div>
        Date:
        ${escapeHTML(
          formatDate(
            new Date()
          )
        )}
      </div>

      <div>
        Counted by:
        Abel Redoblado
      </div>

      <div style="margin-top: 15px;">
        Recounted by:
        ____________________
      </div>
    `;

    const imageName = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    $("receiptPrintArea").dataset.imageFilename =
      `stock-audit-${imageName}`;

    $("receiptModal").hidden =
      false;
  }
);

/* ==========================================================
   PRINT REPORT
   ========================================================== */

function openPrintableHTML(content) {
  const printWindow =
    window.open(
      "",
      "_blank"
    );

  if (!printWindow) {
    alert(
      "Please allow pop-ups to print the report."
    );

    return;
  }

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">

        <title>
          Aventus Medical Inc. Report
        </title>

        <style>
          body {
            font-family:
              Arial,
              sans-serif;

            color: #000;

            padding: 15px;
          }

          h2,
          h3 {
            text-align: center;
          }

          table {
            width: 100%;

            border-collapse:
              collapse;

            font-size: 11px;
          }

          th,
          td {
            border:
              1px solid #000;

            padding: 6px;

            text-align: left;
          }

          @page {
            size: A4;

            margin: 8mm;
          }
        </style>
      </head>

      <body>
        ${content}
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();

    printWindow.print();
  };
}

/* ==========================================================
   CONFIGURATION — ADD ITEM
   ========================================================== */

function renderConfigurationForm(html) {
  $("configurationForm").innerHTML =
    html;
}

$("addItemButton").addEventListener(
  "click",
  () => {
    renderConfigurationForm(`
      <form id="addStockItemForm">
        <h3>
          Add Inventory Item
        </h3>

        <label>
          Item Code

          <input
            name="item_id"
            required
          >
        </label>

        <label>
          Item Name

          <input
            name="description"
            required
          >
        </label>

        <label>
          Category

          <input
            name="category"
            required
          >
        </label>

        <label>
          Unit

          <input
            name="unit"
            required
          >
        </label>

        <label>
          Unit Price

          <input
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            value="0"
          >
        </label>

        <label>
          Beginning Quantity

          <input
            name="beginning_quantity"
            type="number"
            min="0"
            step="1"
            value="0"
            required
          >
        </label>

        <button
          class="primary-btn"
          type="submit"
        >
          Save Item
        </button>
      </form>
    `);

    $("addStockItemForm").addEventListener(
      "submit",
      addStockItem
    );
  }
);

async function addStockItem(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const values =
    Object.fromEntries(
      new FormData(
        form
      ).entries()
    );

  const quantity =
    Number(
      values.beginning_quantity
    );

  const price =
    Number(
      values.unit_price
    );

  if (
    !Number.isInteger(quantity) ||
    quantity < 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    alert(
      "Enter a valid quantity and unit price."
    );

    return;
  }

  const payload = {
    item_id:
      values.item_id.trim(),

    description:
      values.description.trim(),

    category:
      values.category.trim(),

    unit:
      values.unit.trim(),

    unit_price:
      price,

    beginning_quantity:
      quantity,

    beginning_amount:
      quantity * price,

    incoming_quantity:
      0,

    incoming_amount:
      0,

    consumed_quantity:
      0,

    consumed_amount:
      0,

    expired_quantity:
      0,

    expired_amount:
      0,

    transfer_quantity:
      0,

    transfer_amount:
      0,

    ending_quantity:
      quantity,

    ending_amount:
      quantity * price,

    clinic_branch:
      clinicConfig().name
  };

  const { error } =
    await db
      .from(
        clinicConfig().table
      )
      .insert(
        payload
      );

  if (error) {
    alert(
      error.message
    );

    return;
  }

  alert(
    "Item added successfully."
  );

  form.reset();

  await loadStock();
}

/* ==========================================================
   CONFIGURATION — EDIT ITEM
   ========================================================== */

$("editItemButton").addEventListener(
  "click",
  () => {
    renderConfigurationForm(`
      <form id="editStockItemForm">
        <h3>
          Edit Inventory Item
        </h3>

        <label>
          Select Item

          <select
            name="id"
            required
          >
            <option value="">
              Select an item
            </option>

            ${state.stock.map(
              (item) => `
                <option value="${item.id}">
                  ${escapeHTML(
                    item.name
                  )}
                </option>
              `
            ).join("")}
          </select>
        </label>

        <label>
          Item Name

          <input
            name="description"
            required
          >
        </label>

        <label>
          Category

          <input
            name="category"
            required
          >
        </label>

        <label>
          Unit

          <input
            name="unit"
            required
          >
        </label>

        <label>
          Unit Price

          <input
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            required
          >
        </label>

        <button
          class="primary-btn"
          type="submit"
        >
          Save Changes
        </button>
      </form>
    `);

    const form =
      $("editStockItemForm");

    form.elements.id.addEventListener(
      "change",
      () => {
        const item =
          state.stock.find(
            (entry) =>
              entry.id === Number(
                form.elements.id.value
              )
          );

        if (!item) {
          return;
        }

        form.elements.description.value =
          item.name;

        form.elements.category.value =
          item.category;

        form.elements.unit.value =
          item.unit;

        form.elements.unit_price.value =
          item.price;
      }
    );

    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const values =
          Object.fromEntries(
            new FormData(
              form
            ).entries()
          );

        const { error } =
          await db
            .from(
              clinicConfig().table
            )
            .update({
              description:
                values.description.trim(),

              category:
                values.category.trim(),

              unit:
                values.unit.trim(),

              unit_price:
                Number(
                  values.unit_price
                )
            })
            .eq(
              "id",
              Number(
                values.id
              )
            );

        if (error) {
          alert(
            error.message
          );

          return;
        }

        alert(
          "Item updated successfully."
        );

        await loadStock();
      }
    );
  }
);

/* ==========================================================
   STOCK MANAGEMENT
   ========================================================== */

$("manageStockButton").addEventListener(
  "click",
  () => {
    renderConfigurationForm(`
      <div class="config-card">
        <h3>
          Stock Management
        </h3>

        <p>
          Stock movement recording requires
          a database transaction that updates
          quantities and movement history
          together.
        </p>

        <p>
          Direct balance editing is not enabled
          here because it could overwrite stock
          quantities or create inaccurate
          monthly consumption reports.
        </p>
      </div>
    `);
  }
);

/* ==========================================================
   INITIALIZE
   ========================================================== */

async function initializeDashboard() {
  state.clinic =
    $("clinicSelect").value;

  await Promise.all([
    loadStock(),
    loadDepartments()
  ]);

  navigate(
    "dashboard"
  );
}

initializeDashboard();
