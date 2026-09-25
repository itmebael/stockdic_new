
"use strict";

// ============================================
// CONFIGURATION
// ============================================

const $ = (id) => document.getElementById(id);

const CLINICS = Object.freeze({
  pasay: { name: "Pasay Clinic", table: "psy_stock" },
  ane: { name: "ANE Clinic", table: "ane_stock" },
  manila: { name: "Manila Clinic", table: "mnl_stock" }
});

let db = null;
let selectedClinic = null;
let activeClinic = null;
let activeProfile = null;
let stockItems = [];
let selectedItem = null;
let activeCategory = "all";
let loading = false;

function message(id, text) {
  $(id).textContent = text || "";
}

function showError(error) {
  console.error(error);
  alert(error?.message || String(error));
}

function setBusy(button, busy, busyLabel, normalLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : normalLabel;
}

function tableName() {
  if (!activeClinic || !CLINICS[activeClinic]) {
    throw new Error("No authorized clinic is active.");
  }
  return CLINICS[activeClinic].table;
}

function money(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizeItem(row) {
  return {
    id: row.id,
    code: String(row.item_code || row.id),
    name: String(row.item_name || "Unnamed item"),
    category: String(row.category || "Uncategorized"),
    unit: String(row.unit || "pcs"),
    quantity: Number(row.quantity || 0),
    price: Number(row.unit_price || 0),
    description: String(row.description || "")
  };
}

// ============================================
// INITIALIZATION
// ============================================

function initialize() {
  const config = window.STOCK_DICTIONARY_CONFIG;

  if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
    message("loginMessage", "config.js is missing or incomplete.");
    return;
  }

  if (!window.supabase?.createClient) {
    message(
      "loginMessage",
      "Supabase library failed to load. Check your internet connection."
    );
    return;
  }

  try {
    db = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey
    );

    bindEvents();
    restoreSession();
  } catch (error) {
    message("loginMessage", error.message);
  }
}

document.addEventListener("DOMContentLoaded", initialize);

// ============================================
// EVENTS
// ============================================

function bindEvents() {
  document.querySelectorAll("[data-clinic]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedClinic = button.dataset.clinic;

      document.querySelectorAll("[data-clinic]").forEach((other) => {
        other.classList.toggle("selected", other === button);
      });

      message(
        "selectedClinicTitle",
        CLINICS[selectedClinic].name + " Login"
      );

      message("loginMessage", "");
      $("loginForm").hidden = false;
      $("loginEmail").focus();
    });
  });

  $("backToClinics").addEventListener("click", () => {
    selectedClinic = null;
    $("loginForm").hidden = true;
    $("loginForm").reset();
    message("loginMessage", "");

    document.querySelectorAll("[data-clinic]").forEach((button) => {
      button.classList.remove("selected");
    });
  });

  $("loginForm").addEventListener("submit", login);

  $("logoutButton").addEventListener("click", logout);
  $("refreshButton").addEventListener("click", loadInventory);
  $("inventoryNav").addEventListener("click", loadInventory);

  $("searchInput").addEventListener("input", renderInventory);
  $("sortSelect").addEventListener("change", renderInventory);

  $("addItemButton").addEventListener("click", openAddForm);
  $("detailEdit").addEventListener("click", openEditForm);
  $("detailDelete").addEventListener("click", deleteItem);

  $("closeDetail").addEventListener("click", closeDetails);
  $("detailBackdrop").addEventListener("click", closeDetails);

  $("closeItemForm").addEventListener("click", closeItemForm);
  $("cancelItemForm").addEventListener("click", closeItemForm);
  $("itemForm").addEventListener("submit", saveItem);

  $("exportButton").addEventListener("click", exportCSV);
  $("printButton").addEventListener("click", () => window.print());
}

// ============================================
// LOGIN
// ============================================

async function login(event) {
  event.preventDefault();

  if (!db) {
    message("loginMessage", "Supabase is not initialized.");
    return;
  }

  if (!selectedClinic) {
    message("loginMessage", "Please select your clinic first.");
    return;
  }

  const button = $("loginSubmit");
  setBusy(button, true, "Signing in...", "Log In");
  message("loginMessage", "");

  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.user) throw new Error("Login did not return a user.");

    const { data: profile, error: profileError } = await db
      .from("stock_branch_users")
      .select("user_id, clinic_id, full_name, role")
      .eq("user_id", data.user.id)
      .single();

    if (profileError || !profile) {
      await db.auth.signOut();
      throw new Error(
        "Your account has no clinic assignment. Ask the administrator to assign it."
      );
    }

    if (profile.clinic_id !== selectedClinic) {
      await db.auth.signOut();
      throw new Error(
        "This account belongs to a different clinic. Select your assigned clinic."
      );
    }

    if (profile.role !== "stock_clerk") {
      await db.auth.signOut();
      throw new Error("This account does not have stock clerk access.");
    }

    activeClinic = profile.clinic_id;
    activeProfile = profile;

    await openDashboard();
  } catch (error) {
    console.error("Login failed:", error);
    message("loginMessage", error.message || "Login failed.");
  } finally {
    setBusy(button, false, "Signing in...", "Log In");
  }
}

async function restoreSession() {
  if (!db) return;

  try {
    const { data, error } = await db.auth.getUser();

    if (error || !data.user) return;

    const { data: profile, error: profileError } = await db
      .from("stock_branch_users")
      .select("user_id, clinic_id, full_name, role")
      .eq("user_id", data.user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "stock_clerk" ||
      !CLINICS[profile.clinic_id]
    ) {
      await db.auth.signOut();
      return;
    }

    activeClinic = profile.clinic_id;
    activeProfile = profile;

    await openDashboard();
  } catch (error) {
    console.error("Session restore failed:", error);
    message("loginMessage", error.message);
  }
}

async function openDashboard() {
  $("loginScreen").hidden = true;
  $("appScreen").hidden = false;

  message("activeClinicLabel", CLINICS[activeClinic].name);
  message("activeUserName", activeProfile.full_name);
  message("activeUserRole", "Stock Clerk Dashboard");
  message("sectionTitle", CLINICS[activeClinic].name + " Inventory");

  await loadInventory();
}

async function logout() {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    showError(error);
    return;
  }

  activeClinic = null;
  activeProfile = null;
  selectedClinic = null;
  selectedItem = null;
  stockItems = [];
  activeCategory = "all";

  closeDetails();

  $("appScreen").hidden = true;
  $("loginScreen").hidden = false;
  $("loginForm").hidden = true;
  $("loginForm").reset();

  document.querySelectorAll("[data-clinic]").forEach((button) => {
    button.classList.remove("selected");
  });

  message("loginMessage", "");
}

// ============================================
// INVENTORY
// ============================================

async function loadInventory() {
  if (!db || !activeClinic || loading) return;

  loading = true;
  message("syncStatus", "Loading...");

  try {
    const records = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await db
        .from(tableName())
        .select("*")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      records.push(...data);

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    stockItems = records;
    message("syncStatus", "Synced with Supabase");

    renderCategories();
    renderInventory();
  } catch (error) {
    message("syncStatus", "Sync failed");
    showError(error);
  } finally {
    loading = false;
  }
}

function renderCategories() {
  const categories = [
    "all",
    ...new Set(stockItems.map((row) => normalizeItem(row).category))
  ];

  if (!categories.includes(activeCategory)) {
    activeCategory = "all";
  }

  const container = $("categoryTabs");
  container.replaceChildren();

  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-button";
    button.textContent =
      category === "all" ? "All Categories" : category;

    if (category === activeCategory) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategories();
      renderInventory();
    });

    container.appendChild(button);
  }
}

function renderInventory() {
  const query = $("searchInput").value.trim().toLowerCase();
  const sort = $("sortSelect").value;

  const items = stockItems
    .map(normalizeItem)
    .filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;

      const matchesSearch = [
        item.name,
        item.code,
        item.category,
        item.unit,
        item.description
      ].join(" ").toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });

  if (sort === "name-asc") {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "name-desc") {
    items.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === "quantity-desc") {
    items.sort((a, b) => b.quantity - a.quantity);
  } else if (sort === "quantity-asc") {
    items.sort((a, b) => a.quantity - b.quantity);
  }

  message("resultCount", items.length + " items");
  renderSummary(items);

  const grid = $("itemGrid");
  grid.replaceChildren();

  $("emptyState").hidden = items.length > 0;

  for (const item of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "item-card";

    const category = document.createElement("span");
    category.className = "category-pill";
    category.textContent = item.category;

    const name = document.createElement("h3");
    name.textContent = item.name;

    const code = document.createElement("p");
    code.textContent = "Item ID: " + item.code;

    const quantity = document.createElement("strong");
    quantity.textContent = item.quantity + " " + item.unit;

    card.append(category, name, code, quantity);
    card.addEventListener("click", () => openDetails(item.id));
    grid.appendChild(card);
  }
}

function renderSummary(items) {
  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalValue = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  const cards = [
    ["Total Stock Items", items.length],
    ["Total Stock Quantity", totalQuantity],
    ["Estimated Stock Value", money(totalValue)]
  ];

  const strip = $("summaryStrip");
  strip.replaceChildren();

  for (const [label, value] of cards) {
    const card = document.createElement("article");
    card.className = "summary-card";

    const title = document.createElement("span");
    title.textContent = label;

    const number = document.createElement("h2");
    number.textContent = value;

    card.append(title, number);
    strip.appendChild(card);
  }
}

// ============================================
// ITEM DETAILS
// ============================================

function openDetails(id) {
  const row = stockItems.find(
    (item) => String(item.id) === String(id)
  );

  if (!row) return;

  selectedItem = row;
  const item = normalizeItem(row);

  message("detailName", item.name);
  message("detailCategory", item.category);
  message("detailIdMeta", item.code);
  message("detailClinicMeta", CLINICS[activeClinic].name);
  message("detailQuantityMeta", item.quantity + " " + item.unit);
  message("detailUnitMeta", item.unit);
  message("detailPriceMeta", money(item.price));
  message("detailDescriptionMeta", item.description || "No description");

  $("detailBackdrop").hidden = false;
  $("detailPanel").hidden = false;
}

function closeDetails() {
  $("detailBackdrop").hidden = true;
  $("detailPanel").hidden = true;
}

// ============================================
// ADD / EDIT
// ============================================

function openAddForm() {
  selectedItem = null;
  $("itemForm").reset();
  $("itemId").value = "";
  $("itemQuantity").value = "0";
  $("itemPrice").value = "0";
  message("formTitle", "Add Item");
  message("itemFormMessage", "");
  $("itemFormModal").showModal();
}

function openEditForm() {
  if (!selectedItem) return;

  const item = normalizeItem(selectedItem);

  $("itemId").value = item.id;
  $("itemName").value = item.name;
  $("itemCode").value = selectedItem.item_code || "";
  $("itemCategory").value = item.category;
  $("itemUnit").value = item.unit;
  $("itemQuantity").value = item.quantity;
  $("itemPrice").value = item.price;
  $("itemDescription").value = item.description;

  message("formTitle", "Edit Item");
  message("itemFormMessage", "");
  $("itemFormModal").showModal();
}

function closeItemForm() {
  $("itemFormModal").close();
}

async function saveItem(event) {
  event.preventDefault();

  const id = $("itemId").value;
  const quantity = Number($("itemQuantity").value);
  const price = Number($("itemPrice").value || 0);

  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    message("itemFormMessage", "Quantity must be a non-negative whole number.");
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    message("itemFormMessage", "Please enter a valid unit price.");
    return;
  }

  const payload = {
    item_name: $("itemName").value.trim(),
    item_code: $("itemCode").value.trim() || null,
    category: $("itemCategory").value.trim() || "Uncategorized",
    unit: $("itemUnit").value.trim() || "pcs",
    quantity,
    unit_price: price,
    description: $("itemDescription").value.trim()
  };

  if (!payload.item_name) {
    message("itemFormMessage", "Item name is required.");
    return;
  }

  const button = $("saveItemButton");
  setBusy(button, true, "Saving...", "Save Item");
  message("itemFormMessage", "");

  try {
    let query;

    if (id) {
      query = db
        .from(tableName())
        .update(payload)
        .eq("id", id)
        .select("id");
    } else {
      query = db
        .from(tableName())
        .insert(payload)
        .select("id");
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "No record was saved. Check your clinic permissions."
      );
    }

    closeItemForm();
    closeDetails();
    await loadInventory();
  } catch (error) {
    console.error("Save failed:", error);
    message("itemFormMessage", error.message || "Unable to save item.");
  } finally {
    setBusy(button, false, "Saving...", "Save Item");
  }
}

async function deleteItem() {
  if (!selectedItem) return;

  const item = normalizeItem(selectedItem);

  if (!confirm(`Delete "${item.name}" from this clinic's inventory?`)) {
    return;
  }

  try {
    const { data, error } = await db
      .from(tableName())
      .delete()
      .eq("id", selectedItem.id)
      .select("id");

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "No record was deleted. Check your clinic permissions."
      );
    }

    selectedItem = null;
    closeDetails();
    await loadInventory();
  } catch (error) {
    showError(error);
  }
}

// ============================================
// CSV EXPORT
// ============================================

function csvCell(value) {
  if (value === null || value === undefined) return "";

  const text = String(value);

  // Prevent spreadsheet software from evaluating
  // imported inventory text as a formula.
  const safe = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;

  return '"' + safe.replaceAll('"', '""') + '"';
}

function exportCSV() {
  if (!stockItems.length) {
    alert("There are no inventory records to export.");
    return;
  }

  const headers = [
    "Item ID",
    "Item Code",
    "Item Name",
    "Category",
    "Unit",
    "Quantity",
    "Unit Price",
    "Description"
  ];

  const rows = stockItems.map((row) => {
    const item = normalizeItem(row);

    return [
      item.id,
      item.code,
      item.name,
      item.category,
      item.unit,
      item.quantity,
      item.price,
      item.description
    ].map(csvCell).join(",");
  });

  const csv = [
    headers.map(csvCell).join(","),
    ...rows
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = activeClinic + "_stock.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
