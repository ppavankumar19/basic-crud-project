# ShopManager — Simple CRUD App (Learning Project)

A beginner-friendly, end-to-end **CRUD web application** built with:
- **Frontend**: Plain HTML + CSS + JavaScript (no frameworks)
- **Backend**: Python + Flask web framework
- **Database**: SQLite3 (a simple file-based database)

---

## What Does This App Do?

It is a **Product Inventory Manager** — you can:
- Register an account and log in
- **Add** products (name, price, category, quantity)
- **View** all your products in a table
- **Edit** any product
- **Delete** any product
- Search and filter products

---

## What is CRUD?

CRUD stands for the 4 basic operations of any data-driven application:

| Letter | Operation | What It Does             | HTTP Method | SQL Command |
|--------|-----------|--------------------------|-------------|-------------|
| C      | Create    | Add a new product        | POST        | INSERT INTO |
| R      | Read      | View all/one product     | GET         | SELECT      |
| U      | Update    | Change a product's data  | PUT         | UPDATE      |
| D      | Delete    | Remove a product         | DELETE      | DELETE FROM |

Almost every real-world app (Instagram, Amazon, Twitter) is built on CRUD.

---

## Project Structure (File Layout)

```
basic_crud_project/
│
├── README.md                    ← This file (documentation)
│
├── backend/                     ← Server-side code (Python)
│   ├── app.py                   ← THE MAIN BACKEND FILE (Flask server)
│   ├── requirements.txt         ← Python packages to install
│   ├── ecommerce.db             ← SQLite database (auto-created on first run)
│   └── venv/                    ← Virtual environment (Python packages live here)
│
└── frontend/                    ← Client-side code (runs in browser)
    ├── index.html               ← Login / Register page
    ├── dashboard.html           ← Product management dashboard (CRUD page)
    ├── css/
    │   └── style.css            ← All visual styles (colors, layout, fonts)
    └── js/
        ├── auth.js              ← Login & Register logic
        └── products.js          ← All CRUD operations logic
```

---

## Tech Stack Explained

| File/Tool         | What It Is                                      | Why We Need It                              |
|-------------------|-------------------------------------------------|---------------------------------------------|
| `index.html`      | HTML page (structure)                           | The Login / Register form the user sees     |
| `dashboard.html`  | HTML page (structure)                           | The main product table and modals           |
| `style.css`       | CSS stylesheet                                  | Makes the app look nice                     |
| `auth.js`         | JavaScript file                                 | Handles login/register without page refresh |
| `products.js`     | JavaScript file                                 | Handles all CRUD without page refresh       |
| `app.py`          | Python + Flask                                  | The server — handles API requests           |
| `ecommerce.db`    | SQLite database file                            | Stores users and products permanently       |
| `flask`           | Python web framework                            | Makes building APIs easy in Python          |
| `flask-cors`      | Flask extension                                 | Allows browser to call the Flask API        |
| `werkzeug`        | Flask utility library                           | Provides password hashing                   |
| `sqlite3`         | Built-in Python database library                | Lets Python talk to the .db file            |

---

## How the Frontend and Backend Are Connected

This is the most important concept to understand:

```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR BROWSER                            │
│                                                                 │
│   index.html / dashboard.html      (what you SEE)              │
│   css/style.css                    (how it LOOKS)               │
│   js/auth.js / js/products.js      (what it DOES)              │
│                                                                 │
│   When you click "Sign In":                                     │
│     JavaScript collects email + password from the form         │
│     JavaScript sends a fetch() HTTP request to Flask:          │
│                                                                 │
│         POST /api/auth/login                                    │
│         Body: { "email": "...", "password": "..." }            │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTP Request (over the network)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FLASK SERVER (app.py)                      │
│                  Running at http://localhost:5000               │
│                                                                 │
│   Flask receives the POST /api/auth/login request              │
│   Flask reads the email and password from the request body     │
│   Flask queries SQLite: SELECT * FROM users WHERE email = ?    │
│   Flask checks the password hash                               │
│   Flask stores user_id in the session cookie                   │
│   Flask sends back:                                            │
│                                                                 │
│         { "message": "Login successful!", "user": {...} }      │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTP Response (JSON)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR BROWSER                            │
│                                                                 │
│   JavaScript reads the response                                 │
│   If response.ok → redirect to /dashboard                      │
│   If error → show error message in the form                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The key tool is `fetch()` in JavaScript:**
```javascript
// JavaScript sends a request to Flask
const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "john@example.com", password: "abc123" })
});

// JavaScript reads Flask's response
const data = await response.json();
```

**Flask receives it and responds:**
```python
@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()       # Read the JSON the browser sent
    email    = data.get("email")        # Extract email
    password = data.get("password")     # Extract password
    # ... check database ...
    return jsonify({ "message": "Login successful!" }), 200  # Send response
```

---

## What is Flask? (Simple Explanation)

Flask is a Python library that makes building web servers easy.
Without Flask, you'd have to write hundreds of lines of low-level code.

A Flask "route" is a URL + function pair:
```python
@app.route("/api/products", methods=["GET"])
def get_products():
    # This function runs when someone visits GET /api/products
    return jsonify({ "products": [...] })
```

The `@app.route(...)` part is called a **decorator** — it tells Flask
"when a browser visits this URL, run this function".

---

## What is SQLite? (Simple Explanation)

SQLite is a database that stores data in a single file (`ecommerce.db`).
Think of it like a spreadsheet file, but with SQL querying power.

**No separate server needed** — the database is just a file on disk.
Python's built-in `sqlite3` library reads and writes it.

```python
conn   = sqlite3.connect("ecommerce.db")  # Open the database file
cursor = conn.cursor()
cursor.execute("SELECT * FROM products")  # Run a SQL query
rows   = cursor.fetchall()                # Get all matching rows
conn.close()                              # Close the connection
```

---

## What is a Session / Cookie? (Simple Explanation)

When you log in, Flask needs to remember who you are on every
subsequent page request. It does this using a **session cookie**.

```
1. You log in → Flask sets session["user_id"] = 1
2. Flask encrypts this and stores it in a COOKIE in your browser
3. On every future request, the browser automatically sends the cookie
4. Flask reads the cookie → knows you are user #1 → lets you in
5. You log out → Flask clears the session → cookie is gone
```

Think of a cookie like a wristband at an event:
- You buy a ticket (login) → get a wristband (cookie)
- Show the wristband on every ride (request) → allowed in
- Leave the event (logout) → wristband is cut off (cleared)

---

## Database Schema (Table Structure)

### `users` table — stores user accounts

```sql
CREATE TABLE users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- auto ID: 1, 2, 3...
    username   TEXT    UNIQUE NOT NULL,            -- must be unique, can't be empty
    email      TEXT    UNIQUE NOT NULL,            -- must be unique, can't be empty
    password   TEXT    NOT NULL,                   -- stored as a HASH (never plain text!)
    created_at TEXT    DEFAULT CURRENT_TIMESTAMP   -- automatically records when created
);
```

### `products` table — stores products

```sql
CREATE TABLE products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,                              -- optional
    price       REAL    NOT NULL CHECK(price >= 0),     -- cannot be negative
    quantity    INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
    category    TEXT    DEFAULT 'General',
    created_by  INTEGER,              -- links to users.id (who added this product)
    created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

---

## API Endpoints Reference

### Authentication Routes

| Method | URL                    | What It Does                    | Login Required? |
|--------|------------------------|---------------------------------|-----------------|
| POST   | `/api/auth/register`   | Create a new user account       | No              |
| POST   | `/api/auth/login`      | Login — creates a session       | No              |
| POST   | `/api/auth/logout`     | Logout — clears the session     | Yes             |
| GET    | `/api/auth/me`         | Get the current logged-in user  | Yes             |

### Product Routes (CRUD)

| Method | URL                    | What It Does                     | Login Required? |
|--------|------------------------|----------------------------------|-----------------|
| POST   | `/api/products`        | Add a new product (CREATE)       | Yes             |
| GET    | `/api/products`        | Get all products (READ)          | Yes             |
| GET    | `/api/products/<id>`   | Get one product by ID (READ)     | Yes             |
| PUT    | `/api/products/<id>`   | Update a product (UPDATE)        | Yes             |
| DELETE | `/api/products/<id>`   | Delete a product (DELETE)        | Yes             |
| GET    | `/api/categories`      | Get all unique categories        | Yes             |

### Search / Filter Parameters

Add these to the GET `/api/products` URL:

| Parameter  | Example                    | What It Does                       |
|------------|----------------------------|------------------------------------|
| `search`   | `?search=iPhone`           | Show only products with "iPhone" in the name |
| `category` | `?category=Electronics`    | Show only Electronics products     |
| Both       | `?search=pro&category=Books` | Apply both filters at once       |

---

## How Each CRUD Operation Works (Full Flow)

### CREATE — Add a new product

```
1. User clicks "+ Add Product"
   ↓
2. openAddModal() [products.js] — clears the form and opens the popup
   ↓
3. User fills in: Name, Price, Category, Quantity
   ↓
4. User clicks "Save Product"
   ↓
5. handleProductSubmit() [products.js]
   - editProductId is empty → this is a CREATE
   - Collects form data
   ↓
6. fetch("POST /api/products", body: { name, price, ... })
   ↓
7. Flask: create_product() [app.py]
   - Validates the data
   - Runs: INSERT INTO products (name, price, ...) VALUES (?, ?, ...)
   - Returns: { product: { id: 1, name: "iPhone", ... } }
   ↓
8. JavaScript receives response
   - Closes the modal
   - Shows "Product added successfully!" notification
   - Calls loadProducts() to refresh the table
```

### READ — View products

```
1. Page loads (DOMContentLoaded event)
   ↓
2. loadProducts() [products.js]
   ↓
3. fetch("GET /api/products")  [with optional ?search=...&category=...]
   ↓
4. Flask: get_products() [app.py]
   - Runs: SELECT * FROM products WHERE created_by = ?
   - Returns: { products: [ {...}, {...} ], count: 5 }
   ↓
5. renderProducts() [products.js]
   - Loops through products array
   - Creates <tr> HTML for each product
   - Inserts into <tbody id="productsTableBody">
   ↓
6. Table is now visible with all products
```

### UPDATE — Edit a product

```
1. User clicks "Edit" on a product row
   ↓
2. openEditModal(id) [products.js]
   - fetch("GET /api/products/5") — loads current data
   - Pre-fills the form fields with existing values
   - Sets editProductId = 5 (hidden input)
   - Opens the modal
   ↓
3. User changes the fields and clicks "Save Product"
   ↓
4. handleProductSubmit() [products.js]
   - editProductId is "5" → this is an UPDATE
   ↓
5. fetch("PUT /api/products/5", body: { name, price, ... })
   ↓
6. Flask: update_product(5) [app.py]
   - Checks the product exists and belongs to this user
   - Runs: UPDATE products SET name=?, price=?, ... WHERE id=5
   - Returns: { product: { id: 5, name: "Updated Name", ... } }
   ↓
7. Modal closes, table refreshes
```

### DELETE — Remove a product

```
1. User clicks "Delete" on a product row
   ↓
2. openDeleteModal(id, name) [products.js]
   - Shows confirmation popup with product name
   - Stores id in productToDelete variable
   ↓
3. User clicks "Delete" to confirm (or Cancel to abort)
   ↓
4. confirmDelete() [products.js]
   ↓
5. fetch("DELETE /api/products/5")  [no body needed — ID is in URL]
   ↓
6. Flask: delete_product(5) [app.py]
   - Checks the product exists and belongs to this user
   - Runs: DELETE FROM products WHERE id=5 AND created_by=?
   - Returns: { message: "Product 'iPhone' deleted successfully!" }
   ↓
7. Modal closes, table refreshes (product is no longer shown)
```

---

## Key Concepts You Learn from This Project

### Password Hashing
Passwords are NEVER stored as plain text. We convert them to a hash:
```python
# When user registers (in app.py):
hashed = generate_password_hash("abc123")
# Stores: "pbkdf2:sha256:600000$xyz...abc" — looks like random text

# When user logs in (in app.py):
check_password_hash(hashed, "abc123")   # → True  (correct password)
check_password_hash(hashed, "wrong")    # → False (wrong password)
```

### SQL Injection Prevention
We always use `?` placeholders instead of putting values directly in SQL:
```python
# SAFE — use ? placeholders:
conn.execute("SELECT * FROM users WHERE email = ?", (email,))

# DANGEROUS — never do this:
conn.execute(f"SELECT * FROM users WHERE email = '{email}'")
# A hacker could set email = "' OR 1=1 --" and see all users!
```

### XSS Prevention
We escape HTML when displaying user data in the browser:
```javascript
// SAFE — use escapeHtml():
tr.innerHTML = `<td>${escapeHtml(product.name)}</td>`;

// DANGEROUS — inserting raw user data:
tr.innerHTML = `<td>${product.name}</td>`;
// If product.name = "<script>alert('hacked!')</script>"
// the browser would RUN that script!
```

### Debounced Search
We wait 400ms after the last keystroke before searching (avoids too many requests):
```javascript
function debounceSearch() {
    clearTimeout(searchTimer);           // cancel the previous timer
    searchTimer = setTimeout(() => {
        loadProducts();                  // run this after 400ms of silence
    }, 400);
}
```

### Session-Based Auth Guard
Every page that requires login is protected:
```python
# In app.py — the @login_required decorator:
def login_required(f):
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please login first"}), 401
        return f(*args, **kwargs)
    return decorated

# Applied to protected routes:
@app.route("/api/products")
@login_required          # Flask runs this first
def get_products():      # Only runs if logged in
    ...
```

---

## Setup and Run Instructions

### Prerequisites
- Python 3.10 or higher installed
- A modern web browser (Chrome, Firefox, Edge)

### Step 1 — Navigate to the backend folder
```bash
cd basic_crud_project/backend
```

### Step 2 — Create a virtual environment
A virtual environment keeps this project's packages separate from your system Python.
```bash
python3 -m venv venv
```

### Step 3 — Activate the virtual environment

On Linux / macOS:
```bash
source venv/bin/activate
```
On Windows (Command Prompt):
```cmd
venv\Scripts\activate
```
You'll see `(venv)` at the start of your terminal prompt — that means it's active.

### Step 4 — Install required packages
```bash
pip install -r requirements.txt
```
This installs Flask, Flask-CORS, and Werkzeug inside the venv folder.

### Step 5 — Start the Flask server
```bash
python3 app.py
```

You should see:
```
=======================================================
  Simple CRUD App — Python Flask + SQLite3
  Learning: Build a product manager step by step
=======================================================
[DB] Tables created (or already exist).
[SERVER] Running on http://localhost:5000
[TIP]    Open your browser and go to http://localhost:5000
[TIP]    Press CTRL+C to stop the server
```

### Step 6 — Open in your browser
Go to: **http://localhost:5000**

---

## First Time Usage

1. Go to **http://localhost:5000**
2. Click the **Register** tab
3. Enter: username=`admin`, email=`admin@example.com`, password=`admin123`
4. Click **Create Account** — you'll see a success message
5. Switch to the **Login** tab
6. Enter your email and password → click **Sign In**
7. You're redirected to the **Dashboard**
8. Click **+ Add Product** to add your first product

### Sample Products to Try Adding

| Name                       | Category    | Price    | Qty |
|----------------------------|-------------|----------|-----|
| iPhone 15 Pro              | Electronics | 1199.99  | 50  |
| Nike Air Max 270           | Footwear    | 129.99   | 120 |
| The Pragmatic Programmer   | Books       | 49.99    | 200 |
| Sony WH-1000XM5 Headphones | Electronics | 349.99   | 8   |
| Yoga Mat Pro               | Sports      | 39.99    | 0   |

After adding these, try:
- **Searching** for "pro" in the search box
- **Filtering** by category "Electronics"
- **Editing** a product's price
- **Deleting** a product

---

## Common Issues & Fixes

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "Cannot connect to server" in browser | Flask is not running | Run `python3 app.py` in terminal |
| `ModuleNotFoundError: flask` | Packages not installed | Run `pip install -r requirements.txt` |
| Page shows "404 Not Found" | Wrong URL or Flask not running | Check the URL is `http://localhost:5000` |
| "Invalid email or password" | Wrong credentials | Try registering a new account |
| Session expires / logged out | Normal behavior | Log in again |

---

## Dependencies

```
flask==3.0.3        Web server framework
flask-cors==4.0.1   Allows browser to call the API (CORS headers)
werkzeug==3.0.3     Password hashing utilities
sqlite3             Built into Python — no install needed
```

---

## What to Learn Next

Once you are comfortable with this project:

1. **Add more fields** — e.g. an image URL, product SKU, or supplier name
2. **Add pagination** — show only 10 products per page
3. **Add sorting** — click a column header to sort by it
4. **Use PostgreSQL** — replace SQLite with a production database
5. **Add JWT auth** — replace Flask sessions with JSON Web Tokens
6. **Deploy it** — put it on a real server (Railway, Render, or AWS)
7. **Add a React frontend** — rebuild the frontend with a modern framework
