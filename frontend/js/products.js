/**
 * products.js  —  Product CRUD Logic (Dashboard)
 * ================================================
 * This file handles ALL the CRUD operations on dashboard.html.
 * It runs in the browser (frontend) and talks to the Flask
 * backend by sending HTTP requests using fetch().
 *
 * ---------------------------------------------------------------
 * WHAT IS CRUD?
 * ---------------------------------------------------------------
 * CRUD is the 4 basic operations for any data-driven app:
 *
 *   C = CREATE  → Add a new product      → POST   /api/products
 *   R = READ    → View all products      → GET    /api/products
 *   U = UPDATE  → Edit a product         → PUT    /api/products/:id
 *   D = DELETE  → Remove a product       → DELETE /api/products/:id
 *
 * ":id" means the product's ID number goes in the URL.
 * Example: to delete product #5 → DELETE /api/products/5
 *
 * ---------------------------------------------------------------
 * HOW THE TABLE WORKS (READ operation):
 * ---------------------------------------------------------------
 * 1. Page loads → loadProducts() is called
 * 2. fetch() sends GET /api/products to Flask
 * 3. Flask queries the SQLite database:
 *      SELECT * FROM products WHERE created_by = ?
 * 4. Flask sends back JSON: { "products": [ {...}, {...} ] }
 * 5. renderProducts() takes that array and builds HTML table rows
 * 6. The table rows are injected into <tbody id="productsTableBody">
 *
 * This is called "dynamic rendering" — the table content is built
 * by JavaScript, not hard-coded in the HTML.
 *
 * ---------------------------------------------------------------
 * HOW AUTHENTICATION WORKS HERE:
 * ---------------------------------------------------------------
 * Every fetch() request includes: credentials: "include"
 * This tells the browser to send the session cookie with the request.
 * Flask reads the cookie to know who is making the request.
 * If the cookie is missing or expired, Flask returns 401 Unauthorized
 * and we redirect the user back to the login page.
 */


// ---------------------------------------------------------------
// CONSTANTS AND SHARED STATE
// ---------------------------------------------------------------

// API_BASE = "" means "same server" (http://localhost:5000)
// So "/api/products" becomes "http://localhost:5000/api/products"
const API_BASE = "";

// productToDelete stores the ID of the product the user wants to delete.
// We set it when the delete button is clicked (in openDeleteModal),
// and use it when the user confirms deletion (in confirmDelete).
let productToDelete = null;

// searchTimer is used for "debouncing" the search input.
// See debounceSearch() below for a full explanation.
let searchTimer = null;


// ---------------------------------------------------------------
// PAGE LOAD — Runs automatically when the page opens
// ---------------------------------------------------------------

/**
 * DOMContentLoaded fires when the browser has finished loading
 * and parsing all the HTML on the page.
 *
 * We use this to:
 *   1. Check the user is logged in (if not, send to login page)
 *   2. Load and display all products from the server
 *   3. Load categories for the filter dropdown
 *
 * WHY USE async?
 * Because fetch() takes time (the request travels over the network).
 * async/await lets us wait for each step to finish before the next.
 */
window.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();       // Step 1: verify login
  await loadProducts();    // Step 2: fetch and show products
  await loadCategories();  // Step 3: fill the category dropdown
});


/**
 * Checks if the user is currently logged in.
 *
 * HOW IT WORKS:
 * Sends GET /api/auth/me to Flask with the session cookie.
 * If Flask returns 200 OK → user is logged in → show their username in navbar.
 * If Flask returns 401    → not logged in → redirect to login page.
 *
 * This is called an "auth guard" — it guards the dashboard page
 * so only logged-in users can see it.
 */
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include"   // send the session cookie
    });

    if (!res.ok) {
      // Not logged in or session expired — send user to login page
      window.location.href = "/";
      return;
    }

    const data = await res.json();
    // Show the logged-in user's name in the top navigation bar
    // (the #navUsername element is in dashboard.html)
    document.getElementById("navUsername").textContent = data.user.username;

  } catch (err) {
    // Can't reach the server — go to login page
    console.error("Auth check failed:", err);
    window.location.href = "/";
  }
}


// ---------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------

/**
 * Logs the user out.
 *
 * Sends POST /api/auth/logout to Flask.
 * Flask calls session.clear() which removes the session cookie.
 * After that, Flask no longer knows who this user is.
 *
 * We then redirect to "/" (the login page).
 */
async function handleLogout() {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method:      "POST",
    credentials: "include"   // send the cookie so Flask knows which session to clear
  });
  window.location.href = "/";   // go back to login page
}


// ---------------------------------------------------------------
// READ — Load and display all products
// ---------------------------------------------------------------

/**
 * Fetches all products from the server and displays them in the table.
 *
 * HOW SEARCH AND FILTER WORK:
 * We read the current values of the search box and category dropdown.
 * If they have values, we add them as URL query parameters:
 *   /api/products?search=iPhone&category=Electronics
 *
 * Flask reads these parameters and filters the database query:
 *   SELECT * FROM products
 *   WHERE name LIKE '%iPhone%'
 *   AND category = 'Electronics'
 *
 * WHAT IS new URL()?
 * The URL class helps us build URLs with query parameters safely.
 * It handles special characters (like spaces) automatically.
 *
 * Example:
 *   const url = new URL("/api/products", window.location.origin);
 *   url.searchParams.set("search", "iPhone");
 *   // Result: http://localhost:5000/api/products?search=iPhone
 */
async function loadProducts() {
  // Read the current values of the search input and category dropdown
  const search   = document.getElementById("searchInput").value.trim();
  const category = document.getElementById("categoryFilter").value;

  // Build the URL — add query parameters only if they have values
  const url = new URL(`${API_BASE}/api/products`, window.location.origin);
  if (search)   url.searchParams.set("search",   search);
  if (category) url.searchParams.set("category", category);

  // Show the "Loading..." message while waiting for the response
  showLoading(true);

  try {
    // Send GET request to Flask with the session cookie
    const res = await fetch(url.toString(), {
      credentials: "include"
    });

    if (res.status === 401) {
      // 401 = session expired → redirect to login page
      window.location.href = "/";
      return;
    }

    const data = await res.json();   // Parse the JSON response

    if (res.ok) {
      // Success! Build the table rows and update the stats bar
      renderProducts(data.products);
      updateStats(data.products);
    } else {
      showGlobalAlert(data.error || "Failed to load products", "error");
    }

  } catch (err) {
    showGlobalAlert("Cannot connect to the server. Is the backend running?", "error");
    console.error("Load products error:", err);
  } finally {
    showLoading(false);   // Hide the "Loading..." message
  }
}


/**
 * Builds and inserts HTML table rows from the products array.
 *
 * @param {Array} products — array of product objects from the API
 *
 * HOW DYNAMIC HTML WORKS:
 * We loop through each product and create a <tr> (table row) element.
 * We fill it with HTML using a "template literal" (backtick string).
 * Then we append the row to the <tbody> in the HTML.
 *
 * WHAT IS A TEMPLATE LITERAL?
 * A template literal uses backticks (`) instead of quotes.
 * You can embed variables using ${variable}.
 * Example:
 *   const name = "iPhone";
 *   const html = `<td>${name}</td>`;   → "<td>iPhone</td>"
 *
 * WHAT IS escapeHtml()?
 * If a product name contains HTML characters like < > & "
 * they could break our table or even run malicious scripts (XSS attack).
 * escapeHtml() converts them to safe versions:
 *   < → &lt;   > → &gt;   & → &amp;
 * This is called "HTML escaping" and is a security best practice.
 *
 * Each product object looks like this:
 * {
 *   id: 1,
 *   name: "iPhone 15 Pro",
 *   description: "Apple flagship phone",
 *   price: 1199.99,
 *   quantity: 50,
 *   category: "Electronics",
 *   created_at: "2024-01-15 10:30:00"
 * }
 */
function renderProducts(products) {
  const tbody      = document.getElementById("productsTableBody");
  const emptyState = document.getElementById("emptyState");

  tbody.innerHTML = "";   // Clear any existing rows in the table

  if (products.length === 0) {
    // No products found — show the "No products found" message
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";   // Hide the empty state

  // Loop through each product and create a table row for it
  products.forEach((product, index) => {
    const tr = document.createElement("tr");   // Create a new <tr> element

    // Determine the stock status badge (In Stock / Low Stock / Out of Stock)
    const { label: stockLabel, cls: stockCls } = getStockStatus(product.quantity);

    // Format the price as currency: 1199.9 → "$1,199.90"
    // Intl.NumberFormat is a built-in JS object for formatting numbers
    const formattedPrice = new Intl.NumberFormat("en-US", {
      style:    "currency",
      currency: "USD"
    }).format(product.price);

    // Format the date: "2024-01-15 10:30:00" → "Jan 15, 2024"
    const createdDate = new Date(product.created_at).toLocaleDateString("en-US", {
      year:  "numeric",
      month: "short",
      day:   "numeric"
    });

    /**
     * Build the HTML for this table row using a template literal.
     *
     * IMPORTANT: We call escapeHtml() on any data that came from the user
     * (like product.name) before putting it into innerHTML.
     * This prevents XSS (Cross-Site Scripting) attacks.
     *
     * data-id and data-name are "data attributes" — custom HTML attributes
     * that store information we need when buttons are clicked.
     * For example, onclick="openEditModal(${product.id})" directly passes
     * the product ID to the function when the Edit button is clicked.
     */
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-desc">${escapeHtml(product.description || "No description")}</div>
      </td>
      <td><span class="badge">${escapeHtml(product.category)}</span></td>
      <td><span class="price">${formattedPrice}</span></td>
      <td>${product.quantity}</td>
      <td><span class="status-badge ${stockCls}">${stockLabel}</span></td>
      <td>${createdDate}</td>
      <td>
        <div class="action-buttons">
          <button
            class="btn btn-edit"
            onclick="openEditModal(${product.id})"
            title="Edit this product"
          >Edit</button>
          <button
            class="btn btn-delete"
            onclick="openDeleteModal(${product.id}, '${escapeHtml(product.name)}')"
            title="Delete this product"
          >Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);   // Add the row to the table body
  });
}


/**
 * Determines the stock status label and CSS class based on quantity.
 *
 * @param {number} qty — the product's stock quantity
 * @returns {{ label: string, cls: string }}
 *
 * Thresholds:
 *   qty === 0  → "Out of Stock"  (red badge)
 *   qty <= 10  → "Low Stock"     (yellow badge)
 *   qty > 10   → "In Stock"      (green badge)
 *
 * The CSS classes status-no-stock, status-low-stock, status-in-stock
 * are defined in style.css — they control the badge color.
 */
function getStockStatus(qty) {
  if (qty === 0)  return { label: "Out of Stock",  cls: "status-no-stock"  };
  if (qty <= 10)  return { label: "Low Stock",     cls: "status-low-stock" };
  return               { label: "In Stock",       cls: "status-in-stock"  };
}


/**
 * Updates the stats bar at the top of the dashboard.
 *
 * @param {Array} products — array of product objects
 *
 * Calculates:
 *   - Total number of products
 *   - Number of unique categories (using Set to remove duplicates)
 *   - Total inventory value (price × quantity for each product, all added up)
 *
 * WHAT IS Set()?
 * A Set is a collection that automatically removes duplicates.
 * Example: new Set(["Electronics", "Books", "Electronics"]).size → 2
 * (Electronics appears twice, but Set stores it only once)
 *
 * WHAT IS reduce()?
 * Array.reduce() processes every item in the array and builds up
 * a single result (like adding all the values together).
 * sum + (p.price * p.quantity) adds each product's total value.
 */
function updateStats(products) {
  const totalProducts = products.length;
  const categories    = new Set(products.map(p => p.category)).size;   // unique categories count
  const totalValue    = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);

  document.getElementById("totalProducts").textContent   = totalProducts;
  document.getElementById("totalCategories").textContent = categories;
  document.getElementById("totalValue").textContent      = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(totalValue);
}


// ---------------------------------------------------------------
// SEARCH — Debounced live search
// ---------------------------------------------------------------

/**
 * Debounced search — waits 400ms after the user stops typing
 * before sending the search request to the server.
 *
 * WHY DEBOUNCE?
 * Without debounce:
 *   User types "iPhone" → 6 requests sent (one per letter: i, iP, iPh, iPho, iPhon, iPhone)
 *   That's too many requests and slows down the server and browser.
 *
 * With debounce:
 *   User types "iPhone" → only 1 request sent (after they stop typing)
 *
 * HOW IT WORKS:
 *   1. User presses a key → clear any existing timer
 *   2. Set a new timer for 400ms
 *   3. If user presses another key before 400ms → step 1 again
 *   4. User stops typing for 400ms → timer fires → loadProducts() is called
 *
 * clearTimeout()  → cancels a timer that hasn't fired yet
 * setTimeout()    → runs a function after a delay (in milliseconds)
 */
function debounceSearch() {
  clearTimeout(searchTimer);   // Cancel the previous timer (if any)
  searchTimer = setTimeout(() => {
    loadProducts();   // Only run this after 400ms of no typing
  }, 400);
}


/**
 * Clears both the search input and category filter,
 * then reloads all products (no filters applied).
 */
function clearFilters() {
  document.getElementById("searchInput").value    = "";
  document.getElementById("categoryFilter").value = "";
  loadProducts();
}


// ---------------------------------------------------------------
// CATEGORIES — Load categories into the filter dropdown
// ---------------------------------------------------------------

/**
 * Fetches all unique categories from the server and adds them
 * as options in the category filter <select> dropdown.
 *
 * The server runs:
 *   SELECT DISTINCT category FROM products WHERE created_by = ?
 *
 * This gives us a list like: ["Books", "Electronics", "Footwear"]
 *
 * We then create <option> elements and add them to the dropdown.
 */
async function loadCategories() {
  try {
    const res  = await fetch(`${API_BASE}/api/categories`, { credentials: "include" });
    const data = await res.json();

    const select = document.getElementById("categoryFilter");

    // Remove previously added options (to avoid duplicates on refresh)
    const existingDynamic = select.querySelectorAll(".dynamic-option");
    existingDynamic.forEach(o => o.remove());

    // Add a new <option> for each category returned by the server
    data.categories.forEach(cat => {
      const option       = document.createElement("option");
      option.value       = cat;         // the value sent to the server
      option.textContent = cat;         // the text shown to the user
      option.className   = "dynamic-option";  // so we can remove them later
      select.appendChild(option);
    });

  } catch (err) {
    console.warn("Could not load categories:", err);
  }
}


// ---------------------------------------------------------------
// CREATE — Open the "Add Product" modal
// ---------------------------------------------------------------

/**
 * Opens the product form modal in "Add New Product" mode.
 *
 * WHAT IS A MODAL?
 * A modal is a popup window that appears on top of the page.
 * In the HTML, it has a CSS class "modal-overlay" and is hidden by default.
 * We show it by adding the CSS class "active" to it.
 * (The "active" class removes the "display: none" and shows the overlay)
 *
 * HOW WE KNOW IF IT'S ADD OR EDIT MODE:
 * The form has a hidden input: <input type="hidden" id="editProductId">
 * - When editProductId is EMPTY → we are in ADD mode → POST request
 * - When editProductId has a VALUE → we are in EDIT mode → PUT request
 *
 * Here we clear editProductId (set to "") to signal ADD mode.
 */
function openAddModal() {
  document.getElementById("modalTitle").textContent = "Add New Product";
  document.getElementById("editProductId").value    = "";   // empty = ADD mode
  document.getElementById("productForm").reset();           // clear all form inputs
  document.getElementById("productQuantity").value  = "0";  // default quantity = 0
  hideAlert("formError");

  // Show the modal by adding the "active" CSS class
  document.getElementById("productModal").classList.add("active");
}


// ---------------------------------------------------------------
// UPDATE — Open the "Edit Product" modal
// ---------------------------------------------------------------

/**
 * Opens the product form modal in "Edit" mode, pre-filled with the
 * product's current data.
 *
 * @param {number} productId — the ID of the product to edit
 *
 * STEP BY STEP:
 *   1. Send GET /api/products/:id to fetch the current product data
 *   2. Fill each form input with the existing values
 *   3. Store the product ID in the hidden editProductId input
 *   4. Open the modal
 *
 * WHY DO WE FETCH THE PRODUCT AGAIN?
 * We need the latest data (another user might have changed it, or it
 * might have been updated since the page last loaded).
 * Always fetch fresh data before editing.
 *
 * WHAT HAPPENS ON FORM SUBMIT?
 * handleProductSubmit() checks if editProductId has a value.
 * If yes → it sends PUT /api/products/:id (UPDATE).
 * If no  → it sends POST /api/products (CREATE).
 * One form, two behaviours — controlled by the hidden field.
 */
async function openEditModal(productId) {
  try {
    // Fetch the current data for this specific product
    const res  = await fetch(`${API_BASE}/api/products/${productId}`, {
      credentials: "include"
    });
    const data = await res.json();

    if (!res.ok) {
      showGlobalAlert(data.error || "Could not load product data", "error");
      return;
    }

    const p = data.product;   // The product object from the server

    // Set modal to "Edit" mode
    document.getElementById("modalTitle").textContent   = "Edit Product";
    document.getElementById("editProductId").value      = p.id;   // store ID for PUT request

    // Fill each form field with the existing product values
    document.getElementById("productName").value        = p.name;
    document.getElementById("productDescription").value = p.description || "";
    document.getElementById("productPrice").value       = p.price;
    document.getElementById("productQuantity").value    = p.quantity;
    document.getElementById("productCategory").value    = p.category;

    hideAlert("formError");
    // Show the modal
    document.getElementById("productModal").classList.add("active");

  } catch (err) {
    showGlobalAlert("Failed to load product data. Please try again.", "error");
    console.error("Edit modal error:", err);
  }
}


// ---------------------------------------------------------------
// CREATE / UPDATE — Handle form submission
// ---------------------------------------------------------------

/**
 * Handles the form submission for both ADD and EDIT modes.
 *
 * @param {Event} event — the form submit event
 *
 * HOW WE DECIDE: CREATE or UPDATE?
 *   - editProductId is EMPTY → CREATE → send POST /api/products
 *   - editProductId has a NUMBER → UPDATE → send PUT /api/products/:id
 *
 * HTTP METHOD DIFFERENCE:
 *   POST   → creates a brand new product (no ID in URL)
 *   PUT    → updates an existing product (ID in the URL)
 *
 * COLLECTING FORM DATA:
 *   We read each input's .value property.
 *   parseFloat() converts a string like "1199.99" to a number 1199.99
 *   parseInt()   converts a string like "50" to a whole number 50
 *
 * WHAT WE SEND (JSON body):
 *   {
 *     "name":        "iPhone 15 Pro",
 *     "description": "...",
 *     "price":       1199.99,
 *     "quantity":    50,
 *     "category":    "Electronics"
 *   }
 *
 * WHAT WE GET BACK (JSON response from Flask):
 *   {
 *     "message": "Product created successfully!",
 *     "product": { "id": 1, "name": "iPhone 15 Pro", ... }
 *   }
 */
async function handleProductSubmit(event) {
  event.preventDefault();   // Stop the form from refreshing the page

  const submitBtn = document.getElementById("submitBtn");
  const editId    = document.getElementById("editProductId").value;
  const isEditing = editId !== "";   // true if editId is set (we are editing)

  // Collect all the form field values
  const productData = {
    name:        document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price:       parseFloat(document.getElementById("productPrice").value),
    quantity:    parseInt(document.getElementById("productQuantity").value, 10),
    category:    document.getElementById("productCategory").value
  };

  // --- Frontend Validation ---
  if (!productData.name) {
    showAlert("formError", "Product name is required");
    return;
  }
  if (isNaN(productData.price) || productData.price < 0) {
    showAlert("formError", "Please enter a valid price (0 or more)");
    return;
  }
  if (isNaN(productData.quantity) || productData.quantity < 0) {
    showAlert("formError", "Please enter a valid quantity (0 or more)");
    return;
  }

  // Decide the URL and HTTP method based on mode
  const url    = isEditing
    ? `${API_BASE}/api/products/${editId}`   // PUT /api/products/5 (update product #5)
    : `${API_BASE}/api/products`;            // POST /api/products (create new)

  const method = isEditing ? "PUT" : "POST";

  setLoading(submitBtn, true, "Saving...");
  hideAlert("formError");

  try {
    /**
     * Send the CREATE or UPDATE request to Flask.
     *
     * For POST: Flask runs create_product() and inserts a new row.
     * For PUT:  Flask runs update_product() and updates the existing row.
     *
     * Both use the same JSON body format — Flask handles the difference.
     */
    const res  = await fetch(url, {
      method,                                        // "POST" or "PUT"
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify(productData)       // Convert JS object to JSON text
    });

    const data = await res.json();

    if (res.ok) {
      closeModal();   // Close the form modal
      // Show a success notification at the bottom-right corner
      showGlobalAlert(
        isEditing
          ? `"${data.product.name}" updated successfully!`
          : `"${data.product.name}" added successfully!`,
        "success"
      );
      loadProducts();    // Refresh the table to show the new/updated product
      loadCategories();  // Refresh the category dropdown
    } else {
      // Server returned an error — show it inside the form
      showAlert("formError", data.error || "Failed to save product");
    }

  } catch (err) {
    showAlert("formError", "Cannot connect to the server. Please check the backend is running.");
    console.error("Save product error:", err);
  } finally {
    setLoading(submitBtn, false, "Save Product");
  }
}


// ---------------------------------------------------------------
// DELETE — Confirm and delete a product
// ---------------------------------------------------------------

/**
 * Opens the delete confirmation modal.
 *
 * @param {number} productId   — the ID of the product to delete
 * @param {string} productName — the product's name (to show in the confirmation)
 *
 * WHY DO WE ASK FOR CONFIRMATION?
 * Deleting is permanent — we want to make sure the user didn't
 * accidentally click Delete. The confirmation step prevents accidents.
 *
 * WHY DO WE STORE productToDelete?
 * When the user clicks the red "Delete" button in the confirmation modal,
 * we call confirmDelete(). That function needs to know WHICH product to delete.
 * We store the ID in productToDelete so confirmDelete() can use it.
 */
function openDeleteModal(productId, productName) {
  productToDelete = productId;   // Remember which product to delete
  document.getElementById("deleteProductName").textContent = productName;
  document.getElementById("deleteModal").classList.add("active");
}


/**
 * Executes the actual delete after the user confirms.
 *
 * HTTP METHOD: DELETE
 *   fetch(url, { method: "DELETE" })
 *
 * IMPORTANT DIFFERENCE FROM POST/PUT:
 *   DELETE requests do NOT have a body — the product ID is in the URL.
 *   We do NOT send a JSON body. Flask reads the ID from the URL.
 *
 * URL: /api/products/5
 * Flask runs: DELETE FROM products WHERE id = 5
 * Then returns: { "message": "Product 'iPhone 15 Pro' deleted successfully!" }
 */
async function confirmDelete() {
  if (!productToDelete) return;   // Safety check — nothing to delete

  const btn = document.getElementById("confirmDeleteBtn");
  setLoading(btn, true, "Deleting...");

  try {
    const res = await fetch(`${API_BASE}/api/products/${productToDelete}`, {
      method:      "DELETE",   // HTTP DELETE method — removes the resource
      credentials: "include"
      // No body needed for DELETE — the ID is in the URL
    });

    const data = await res.json();

    if (res.ok) {
      closeDeleteModal();
      showGlobalAlert(data.message, "success");
      loadProducts();    // Refresh the table (the deleted product is now gone)
      loadCategories();  // Refresh category dropdown (category might be unused now)
    } else {
      showGlobalAlert(data.error || "Failed to delete product", "error");
      closeDeleteModal();
    }

  } catch (err) {
    showGlobalAlert("Cannot connect to the server", "error");
    console.error("Delete error:", err);
  } finally {
    setLoading(btn, false, "Delete");
    productToDelete = null;   // Reset — no longer waiting to delete anything
  }
}


// ---------------------------------------------------------------
// MODAL HELPERS — Open and close the popup windows
// ---------------------------------------------------------------

/**
 * Closes the Add/Edit product modal.
 * Removes the "active" CSS class → the modal becomes hidden (display: none).
 */
function closeModal() {
  document.getElementById("productModal").classList.remove("active");
  document.getElementById("productForm").reset();   // clear form inputs
  hideAlert("formError");
}

/** Closes the delete confirmation modal. */
function closeDeleteModal() {
  document.getElementById("deleteModal").classList.remove("active");
  productToDelete = null;
}

/**
 * Allows the user to close the modal by clicking the dark overlay
 * (the area outside the white popup box).
 *
 * event.target is the element that was actually clicked.
 * If the user clicked the overlay itself (not the modal box inside it),
 * we close the modal. If they clicked inside the modal, we do nothing.
 */
function closeModalOnOverlay(event) {
  if (event.target === document.getElementById("productModal")) {
    closeModal();
  }
}

function closeDeleteModalOnOverlay(event) {
  if (event.target === document.getElementById("deleteModal")) {
    closeDeleteModal();
  }
}


// ---------------------------------------------------------------
// UTILITY HELPERS
// ---------------------------------------------------------------

/**
 * Shows or hides the "Loading products..." message.
 * @param {boolean} show — true = show loading, false = hide it
 */
function showLoading(show) {
  document.getElementById("loadingState").style.display = show ? "block" : "none";
  if (show) {
    document.getElementById("emptyState").style.display     = "none";
    document.getElementById("productsTableBody").innerHTML  = "";
  }
}

/**
 * Shows a floating notification at the bottom-right corner of the screen.
 * Automatically disappears after 3 seconds.
 *
 * @param {string} message          — the text to show
 * @param {"success" | "error"} type — controls the color (green or red)
 */
function showGlobalAlert(message, type = "success") {
  const el     = document.getElementById("globalAlert");
  el.textContent = message;
  el.className   = `global-alert alert alert-${type}`;  // CSS class sets the color
  el.style.display = "block";

  // Auto-hide after 3 seconds (3000 milliseconds)
  setTimeout(() => {
    el.style.display = "none";
  }, 3000);
}

/**
 * Shows an inline alert message inside a form.
 * @param {string} id      — the HTML element's id
 * @param {string} message — the text to show
 */
function showAlert(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent   = message;
    el.style.display = "block";
  }
}

/** Hides an inline alert element. */
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

/**
 * Sets a button to loading state or normal state.
 * @param {HTMLButtonElement} btn
 * @param {boolean}           loading — true = disable, false = enable
 * @param {string}            label   — button text
 */
function setLoading(btn, loading, label) {
  btn.disabled    = loading;
  btn.textContent = label;
}

/**
 * Escapes HTML special characters to prevent XSS (Cross-Site Scripting).
 *
 * WHAT IS XSS?
 * XSS is a security attack where someone tricks a website into
 * running malicious JavaScript by injecting it as data.
 *
 * Example of the attack:
 *   Product name entered by user: <script>alert('Hacked!')</script>
 *   Without escaping: the browser would RUN that script
 *   With escaping:    it shows as literal text — harmless
 *
 * How escaping works:
 *   < becomes &lt;   (browser shows < but doesn't treat it as HTML)
 *   > becomes &gt;
 *   & becomes &amp;
 *   " becomes &quot;
 *   ' becomes &#39;
 *
 * ALWAYS use escapeHtml() when inserting user-provided data into innerHTML.
 *
 * @param {string} str — raw string from the API (might contain HTML characters)
 * @returns {string}   — safe string that won't be interpreted as HTML
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}
