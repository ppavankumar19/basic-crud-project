# ==============================================================
# app.py  —  The Main Backend File  (The Server)
# ==============================================================
#
# WHAT IS THIS FILE?
# ------------------
# This is the BACKEND of the application.
# It is a Python program that runs as a "server" — it stays
# running on your computer, listening for requests from the
# browser, and answering them.
#
# Think of the app like a RESTAURANT:
#   FRONTEND (browser/HTML) = the CUSTOMER who places an order
#   BACKEND  (this file)    = the KITCHEN that prepares the food
#   DATABASE (ecommerce.db) = the STORAGE ROOM that holds ingredients
#
# HOW DOES THE FRONTEND TALK TO THE BACKEND?
# -------------------------------------------
# The browser sends HTTP requests to URLs (called API endpoints).
# Flask (this file) receives the request, does the work,
# and sends back a JSON response.
#
#   Browser (JS fetch)  ----HTTP request---->  Flask (Python)
#   Browser (JS fetch)  <---JSON response----  Flask (Python)
#
# For example:
#   Browser sends:  GET /api/products
#   Flask runs:     get_products() function
#   Flask sends:    { "products": [...] }
#   Browser shows:  the products in a table
#
# WHAT IS AN API ENDPOINT?
# -------------------------
# An endpoint is just a URL that does one specific job.
# Like a door in a restaurant — each door leads to a different room:
#   /api/auth/register  →  create a new user account
#   /api/auth/login     →  check password and log in
#   /api/products       →  get all products (GET) or add new one (POST)
#   /api/products/5     →  work with product ID=5 (update or delete)
#
# WHAT IS JSON?
# -------------
# JSON is the "language" used to send data between frontend and backend.
# It looks like a Python dictionary:
#   { "name": "iPhone", "price": 999.99, "quantity": 50 }
# The browser sends JSON to us, and we send JSON back.
#
# WHAT IS HTTP?
# -------------
# HTTP is how browsers and servers communicate on the internet.
# HTTP has different "methods" (verbs) that tell the server what to do:
#   GET    = "Please give me some data"           → Read
#   POST   = "Here is new data, please save it"  → Create
#   PUT    = "Here is updated data for item X"   → Update
#   DELETE = "Please delete item X"              → Delete
#
# These 4 operations together are called CRUD:
#   C = Create  (POST)
#   R = Read    (GET)
#   U = Update  (PUT)
#   D = Delete  (DELETE)
#
# ==============================================================


# ==============================================================
# IMPORTS — Bring in the tools (libraries) we need
# ==============================================================

# Flask is a Python web framework.
# A "framework" gives us ready-made tools so we don't have to
# build everything from scratch.
#
# Flask          → the main web framework (creates the app, handles routing)
# request        → lets us read what the browser sent us
#                  (JSON body, URL parameters, form data)
# jsonify        → converts a Python dict into a JSON HTTP response
# session        → lets us store data in the browser's cookie
#                  (used to remember who is logged in)
# send_from_directory → sends an HTML/CSS/JS file to the browser
from flask import Flask, request, jsonify, session, send_from_directory

# flask_cors → CORS = Cross-Origin Resource Sharing
# By default, browsers block JavaScript from calling a different server.
# For example: our HTML page at localhost:5000 calling our API also at
# localhost:5000 needs CORS enabled. Without it, the browser blocks fetch().
from flask_cors import CORS

# Werkzeug provides password security utilities:
#   generate_password_hash("abc123") → "$pbkdf2-sha256:..." (a safe hash)
#   check_password_hash(hash, "abc123") → True or False
# We NEVER store passwords as plain text. Always hash them.
from werkzeug.security import generate_password_hash, check_password_hash

# sqlite3 is Python's built-in library for SQLite databases.
# SQLite is a simple database stored in a single .db file on disk.
# No separate database server needed — just a file.
import sqlite3

# os lets us build file paths that work on any operating system.
import os

# functools.wraps helps us write "decorator" functions correctly.
from functools import wraps


# ==============================================================
# CREATE THE FLASK APP
# ==============================================================

# Flask(__name__) creates the web application object.
# We call it "app" — we'll use it throughout this file.
app = Flask(__name__)

# SECRET_KEY is used to encrypt the session cookie.
# The session cookie is how Flask knows who is logged in.
# In a real production app, use a long random key and store it
# in an environment variable — NEVER hard-code it like this.
# For learning purposes, a simple string is fine.
app.secret_key = "simple_crud_secret_key_change_in_production"

# Enable CORS — allow the browser to call our API.
# supports_credentials=True is required for session cookies to work.
CORS(app, supports_credentials=True)

# Path to the frontend folder (one level up from the backend/ folder).
# This is where our HTML, CSS, and JS files live.
# os.path.dirname(__file__) = the folder where app.py is saved (backend/)
# ".." = go one level up to the project root
# "frontend" = then go into the frontend folder
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


# ==============================================================
# SERVE FRONTEND HTML PAGES
# ==============================================================
# Flask can also serve HTML files — so we do not need a separate
# web server for the frontend. Just run Flask and open localhost:5000.

@app.route("/")
def serve_index():
    """
    When the browser visits http://localhost:5000/
    Flask sends back the Login/Register HTML page.

    @app.route("/") is called a "route decorator".
    It tells Flask: "when someone visits URL '/', run this function".

    send_from_directory reads the file from disk and sends it to the browser.
    """
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/dashboard")
def serve_dashboard():
    """
    When the browser visits http://localhost:5000/dashboard
    Flask sends back the Dashboard HTML page.

    We also check if the user is logged in first.
    If not, we redirect them back to the login page.
    """
    if "user_id" not in session:
        # redirect() tells the browser "go to this URL instead"
        from flask import redirect
        return redirect("/")
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/css/<path:filename>")
def serve_css(filename):
    """Serves CSS files like /css/style.css from the frontend/css/ folder."""
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)


@app.route("/js/<path:filename>")
def serve_js(filename):
    """Serves JavaScript files like /js/auth.js from the frontend/js/ folder."""
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)


# ==============================================================
# DATABASE SETUP
# ==============================================================

# This is where the database file will be saved.
# __file__ = full path to this app.py file
# os.path.dirname gives us the folder it's in (backend/)
# We save ecommerce.db in the same folder as app.py
DB_PATH = os.path.join(os.path.dirname(__file__), "ecommerce.db")


def get_db():
    """
    Opens a connection to the SQLite database and returns it.

    WHAT IS A DATABASE CONNECTION?
    --------------------------------
    Think of the database file like a locked notebook.
    A "connection" is the key that lets you open and read/write it.

    We open a connection when we need to do something (read/write data),
    and close it when we're done. This is good practice.

    ROW FACTORY:
    The default SQLite connection returns rows as plain tuples: (1, "iPhone")
    Setting row_factory = sqlite3.Row lets us access data by column name:
        row["name"]  instead of  row[1]
    This makes the code much easier to read.
    """
    conn = sqlite3.connect(DB_PATH)
    # sqlite3.Row lets us access values by column name: row["name"]
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """
    Creates the database tables when the server first starts.

    If the tables already exist, "CREATE TABLE IF NOT EXISTS"
    safely skips creation — it will NOT delete existing data.

    WHAT IS A DATABASE TABLE?
    --------------------------
    A table is like a spreadsheet:
        - Columns = fields (id, name, price, ...)
        - Rows    = individual records (each product)

    We have 2 tables:
        users    = stores user accounts
        products = stores product listings

    SQL KEYWORDS EXPLAINED:
    -----------------------
    INTEGER PRIMARY KEY AUTOINCREMENT
        → This column is a unique number (ID) that auto-increases:
          1st row = 1, 2nd row = 2, 3rd row = 3, etc.

    TEXT NOT NULL
        → This column stores text, and it MUST have a value.
          Cannot be empty/blank.

    UNIQUE
        → No two rows can have the same value in this column.
          e.g. two users cannot share the same email address.

    DEFAULT 'General'
        → If no value is given when inserting a row, use 'General'.

    CHECK(price >= 0)
        → A validation rule. The database will reject any row
          where price is negative.

    FOREIGN KEY (created_by) REFERENCES users(id)
        → Links the products table to the users table.
          products.created_by holds a user's id.
          This tells us WHICH user created each product.
    """
    conn   = get_db()
    cursor = conn.cursor()

    # ---- TABLE 1: users ----
    # Stores all registered user accounts.
    # Passwords are stored as a HASH (never as plain text).
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT    UNIQUE NOT NULL,
            email      TEXT    UNIQUE NOT NULL,
            password   TEXT    NOT NULL,
            created_at TEXT    DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ---- TABLE 2: products ----
    # Stores the product inventory.
    # created_by links to the users table — each product has an owner.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            description TEXT,
            price       REAL    NOT NULL CHECK(price >= 0),
            quantity    INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
            category    TEXT    DEFAULT 'General',
            created_by  INTEGER,
            created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
            updated_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    """)

    conn.commit()   # Save the changes to the database file
    conn.close()
    print("[DB] Tables created (or already exist).")


# ==============================================================
# LOGIN REQUIRED DECORATOR
# ==============================================================

def login_required(f):
    """
    A "decorator" that protects routes from unauthenticated access.

    WHAT IS A DECORATOR?
    ---------------------
    A decorator is a function that wraps another function to add
    extra behavior. We place @login_required above a route function
    to make Flask automatically check if the user is logged in
    before running that function.

    HOW IT WORKS:
        @app.route("/api/products")
        @login_required          ← this runs first
        def get_products():      ← this runs second (only if logged in)
            ...

    WHAT IS A SESSION?
    ------------------
    When a user logs in, we store their user_id in the session:
        session["user_id"] = 1

    Flask encrypts this into a cookie and sends it to the browser.
    The browser stores the cookie and automatically sends it back
    with EVERY future request. Flask decrypts the cookie and reads
    session["user_id"] = 1 — this is how Flask knows who is logged in.

    If session["user_id"] does not exist, the user is not logged in.
    In that case we return a 401 Unauthorized error.
    """
    @wraps(f)   # @wraps preserves the original function's name and docstring
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            # 401 = Unauthorized — user must log in first
            return jsonify({
                "error": "Please login first. Your session may have expired."
            }), 401
        return f(*args, **kwargs)   # User is logged in — run the actual route function
    return decorated


# ==============================================================
# AUTH ROUTES  (Register, Login, Logout, Me)
# ==============================================================


# ---- REGISTER -----------------------------------------------
@app.route("/api/auth/register", methods=["POST"])
def register():
    """
    Creates a new user account.

    HTTP Method : POST
    URL         : /api/auth/register
    Auth needed : No (anyone can register)

    ---
    What the browser sends (JSON body):
        {
            "username": "john_doe",
            "email":    "john@example.com",
            "password": "secret123"
        }

    What this function does (step by step):
        1. Read the JSON data the browser sent
        2. Validate: check nothing is missing or too short
        3. Hash the password (turn "secret123" into a safe hash)
        4. Try to INSERT a new row into the users table
        5. Return a success message or error

    ---
    HOW WE READ JSON FROM THE REQUEST:
        data = request.get_json()
        This reads the JSON body and gives us a Python dictionary.

        data.get("username", "")  →  reads "username" from the dict.
        The second argument ("") is the default if the key is missing.
        .strip()  removes extra spaces from the start and end.

    ---
    HOW PASSWORD HASHING WORKS:
        generate_password_hash("secret123")
        Returns something like: "pbkdf2:sha256:600000$abcd..."

        This hash is stored in the database.
        The original password "secret123" is NOT stored anywhere.

        When the user logs in, we use:
        check_password_hash(stored_hash, "secret123") → True

        This is secure because even if someone steals the database,
        they cannot easily recover the original passwords.

    ---
    SQL USED:
        INSERT INTO users (username, email, password)
        VALUES (?, ?, ?)

        The ? placeholders are filled in safely by SQLite.
        This prevents SQL Injection — a type of security attack.

    ---
    HTTP RESPONSE CODES:
        201 Created     = new resource was created successfully
        400 Bad Request = invalid input (missing field, too short, etc.)
        409 Conflict    = email or username already taken
    """
    data = request.get_json()

    # If no JSON was sent at all, return an error
    if not data:
        return jsonify({"error": "No data provided. Send JSON with username, email, password."}), 400

    # Read each field, strip whitespace, use empty string as default
    username = data.get("username", "").strip()
    email    = data.get("email",    "").strip().lower()   # lowercase for consistency
    password = data.get("password", "")

    # --- Validation ---
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400

    # Hash the password — NEVER store plain text passwords
    hashed_pw = generate_password_hash(password)

    conn = get_db()
    try:
        # Try to insert the new user
        conn.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (username, email, hashed_pw)
            # The ? placeholders prevent SQL Injection attacks.
            # SQLite safely inserts the values.
        )
        conn.commit()   # Save the new user to the database file
        return jsonify({"message": "User registered successfully!"}), 201

    except sqlite3.IntegrityError:
        # IntegrityError is raised when a UNIQUE constraint fails.
        # This means someone already has this username or email.
        return jsonify({"error": "Username or email already taken. Please try another."}), 409

    finally:
        # "finally" always runs — even if there was an error.
        # Always close the database connection when done.
        conn.close()


# ---- LOGIN --------------------------------------------------
@app.route("/api/auth/login", methods=["POST"])
def login():
    """
    Logs in a user. Creates a session so they stay logged in.

    HTTP Method : POST
    URL         : /api/auth/login
    Auth needed : No

    ---
    What the browser sends:
        { "email": "john@example.com", "password": "secret123" }

    What this function does:
        1. Read email and password from the request
        2. Look up the user in the database by email
        3. Check if the password matches the stored hash
        4. If yes, store user info in the session (create login state)
        5. Return user info (WITHOUT the password — never send it back!)

    ---
    HOW SESSION WORKS IN SIMPLE TERMS:
        After login, we do:
            session["user_id"]  = 1
            session["username"] = "john_doe"

        Flask takes this, encrypts it with the SECRET_KEY, and puts it
        in a small text file called a "cookie" in the browser.

        On every future request, the browser automatically sends this
        cookie back to Flask. Flask decrypts it and reads:
            session["user_id"]  = 1
            session["username"] = "john_doe"

        This is how Flask knows who is logged in on each request.

    ---
    HTTP RESPONSE CODES:
        200 OK           = login successful
        400 Bad Request  = missing email or password
        401 Unauthorized = wrong email or password
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided. Send JSON with email and password."}), 400

    email    = data.get("email",    "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are both required"}), 400

    conn = get_db()

    # SELECT * FROM users WHERE email = ?
    # → Look for a user row where the email column matches
    # fetchone() → gets the first matching row (or None if not found)
    user = conn.execute(
        "SELECT * FROM users WHERE email = ?",
        (email,)    # Note: (email,) is a Python tuple with one item
    ).fetchone()
    conn.close()

    # Check if user exists AND password matches the hash
    if not user or not check_password_hash(user["password"], password):
        # We use the same error message for both cases (security best practice).
        # We don't want to tell hackers whether the email exists or not.
        return jsonify({"error": "Invalid email or password"}), 401

    # --- Login successful! Store user info in the session ---
    session["user_id"]  = user["id"]
    session["username"] = user["username"]

    # Return user info — but DO NOT include the password field
    return jsonify({
        "message": "Login successful!",
        "user": {
            "id":       user["id"],
            "username": user["username"],
            "email":    user["email"]
        }
    }), 200


# ---- LOGOUT -------------------------------------------------
@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    Logs out the current user by clearing the session.

    HTTP Method : POST
    URL         : /api/auth/logout

    session.clear() removes ALL data from the session cookie.
    After this, session["user_id"] no longer exists.
    So any @login_required route will return 401 Unauthorized.

    The browser's copy of the cookie is also cleared on the next response.
    """
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


# ---- ME (Get Current User) ----------------------------------
@app.route("/api/auth/me", methods=["GET"])
@login_required   # Must be logged in to use this route
def me():
    """
    Returns the currently logged-in user's info.

    HTTP Method : GET
    URL         : /api/auth/me
    Auth needed : Yes

    The frontend calls this when the page loads to:
      1. Check if the user is logged in
      2. Get the username to display in the navbar

    Since @login_required is applied above, if the user is NOT
    logged in, Flask returns 401 before this function even runs.

    ---
    Response (200):
        { "user": { "id": 1, "username": "john_doe" } }
    """
    return jsonify({
        "user": {
            "id":       session["user_id"],
            "username": session["username"]
        }
    }), 200


# ==============================================================
# PRODUCT ROUTES  (CRUD)
# ==============================================================
#
# All product routes require the user to be logged in (@login_required).
# Each user can only see and manage their OWN products.
# The "created_by" column links each product to a specific user.
#
# URL PARAMETER EXPLAINED:
#   @app.route("/api/products/<int:product_id>")
#   <int:product_id> means: capture a number from the URL
#   and pass it as the "product_id" parameter to the function.
#
#   Example:  GET /api/products/5
#   Flask captures "5" and calls get_product(product_id=5)
#


# ---- CREATE (POST /api/products) ----------------------------
@app.route("/api/products", methods=["POST"])
@login_required
def create_product():
    """
    Creates a new product in the database.

    HTTP Method : POST
    URL         : /api/products
    Auth needed : Yes

    ---
    What the browser sends (JSON body):
        {
            "name":        "iPhone 15 Pro",
            "description": "Apple's flagship phone",
            "price":       1199.99,
            "quantity":    50,
            "category":    "Electronics"
        }

    What this function does:
        1. Check the user is logged in (handled by @login_required)
        2. Read and validate the product data
        3. Run an INSERT SQL query to add a new row to the products table
        4. Return the newly created product (including its new database ID)

    ---
    SQL EXPLAINED:
        INSERT INTO products (name, description, price, quantity, category, created_by)
        VALUES (?, ?, ?, ?, ?, ?)

        INSERT INTO = "add a new row to this table"
        The column names in () = which columns we are filling in
        VALUES       = the actual data for each column
        ?            = placeholder (safer than putting values directly in the string)

        session["user_id"] is the ID of the currently logged-in user.
        We store it as created_by so we know who created each product.

    ---
    cursor.lastrowid:
        After INSERT, SQLite assigns the new row an auto-generated ID.
        cursor.lastrowid gives us that ID so we can fetch the new row.

    ---
    HTTP Response Codes:
        201 Created     = product was added successfully
        400 Bad Request = missing required field or invalid value
        401 Unauthorized = not logged in (handled by @login_required)
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided. Send JSON with product details."}), 400

    # Read product fields from the JSON
    name      = data.get("name", "").strip()
    price_raw = data.get("price")   # We'll convert to float below

    # Validate required fields
    if not name:
        return jsonify({"error": "Product name is required"}), 400
    if price_raw is None:
        return jsonify({"error": "Product price is required"}), 400

    # Convert price and quantity to numbers
    # (float() and int() raise ValueError if the value is not a number)
    try:
        price    = float(price_raw)
        quantity = int(data.get("quantity", 0))
    except (ValueError, TypeError):
        return jsonify({"error": "Price must be a number (e.g. 19.99) and quantity must be a whole number"}), 400

    if price < 0:
        return jsonify({"error": "Price cannot be negative"}), 400
    if quantity < 0:
        return jsonify({"error": "Quantity cannot be negative"}), 400

    description = data.get("description", "").strip()
    category    = data.get("category", "General").strip()

    conn   = get_db()
    cursor = conn.execute(
        """
        INSERT INTO products (name, description, price, quantity, category, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (name, description, price, quantity, category, session["user_id"])
    )
    conn.commit()   # Save the new row to the database file

    # cursor.lastrowid = the auto-generated ID of the row we just inserted
    # We use it to fetch the full row and return it to the browser
    new_product = conn.execute(
        "SELECT * FROM products WHERE id = ?",
        (cursor.lastrowid,)
    ).fetchone()
    conn.close()

    return jsonify({
        "message": "Product created successfully!",
        "product": dict(new_product)   # dict() converts sqlite3.Row to a plain Python dict
    }), 201


# ---- READ ALL (GET /api/products) ---------------------------
@app.route("/api/products", methods=["GET"])
@login_required
def get_products():
    """
    Returns all products for the logged-in user.
    Supports optional search and category filter via URL parameters.

    HTTP Method : GET
    URL         : /api/products
    Auth needed : Yes

    ---
    URL Query Parameters (all optional):
        ?search=iPhone       → only products whose name contains "iPhone"
        ?category=Electronics → only products in the "Electronics" category
        You can combine both: ?search=pro&category=Books

    Examples:
        GET /api/products                           → all my products
        GET /api/products?search=shoe               → products with "shoe" in name
        GET /api/products?category=Electronics      → all Electronics products
        GET /api/products?search=pro&category=Books → "pro" in Books category

    ---
    HOW QUERY PARAMETERS WORK:
        In the URL: /api/products?search=iPhone
        The ? starts the query parameters.
        search=iPhone is one parameter.
        Multiple parameters are separated by &

        In Flask we read them with:
            request.args.get("search", "")
            request.args.get("category", "")

    ---
    HOW THE SQL SEARCH WORKS:
        WHERE name LIKE '%iPhone%'
        The % is a wildcard meaning "any characters here".
        '%iPhone%' matches: "iPhone 15 Pro", "My iPhone Case", "iphone mini"
        It does NOT match: "Samsung Galaxy" (no "iPhone" in the name)

    ---
    HOW WE BUILD THE QUERY DYNAMICALLY:
        We start with a base query:
            SELECT * FROM products WHERE created_by = 5

        Then add conditions IF the filters are provided:
            AND name LIKE '%iPhone%'
            AND category = 'Electronics'

        This lets us handle 0, 1, or 2 filters with the same code.

    ---
    Response (200):
        { "products": [...], "count": 5 }
    """
    # Read the optional search and category filters from the URL
    # request.args is a dictionary of URL query parameters (?key=value)
    search   = request.args.get("search",   "").strip()
    category = request.args.get("category", "").strip()

    # Build the SQL query dynamically
    # WHERE 1=1 is always true — it gives us a safe base to append conditions to
    query  = "SELECT * FROM products WHERE created_by = ?"
    params = [session["user_id"]]   # Always filter to THIS user's products only

    # Add search filter if the user typed something in the search box
    if search:
        query += " AND name LIKE ?"
        params.append(f"%{search}%")   # f-string wraps the search term in % wildcards

    # Add category filter if the user selected a category
    if category:
        query += " AND category = ?"
        params.append(category)

    # Sort newest products first
    query += " ORDER BY created_at DESC"

    conn     = get_db()
    rows     = conn.execute(query, params).fetchall()
    conn.close()

    # Convert each sqlite3.Row into a plain Python dictionary
    # (so jsonify can convert it to JSON)
    products = [dict(row) for row in rows]

    return jsonify({
        "products": products,
        "count":    len(products)
    }), 200


# ---- READ ONE (GET /api/products/<id>) ----------------------
@app.route("/api/products/<int:product_id>", methods=["GET"])
@login_required
def get_product(product_id):
    """
    Returns a single product by its ID.

    HTTP Method : GET
    URL         : /api/products/5  (where 5 is the product ID)
    Auth needed : Yes

    The frontend calls this when the user clicks "Edit" on a product.
    It pre-fills the edit form with the product's current values.

    <int:product_id> in the URL tells Flask to:
        - Capture the number from the URL (e.g. 5 from /api/products/5)
        - Convert it to a Python integer
        - Pass it to this function as the parameter "product_id"

    ---
    SQL EXPLAINED:
        SELECT * FROM products WHERE id = ? AND created_by = ?

        We check BOTH the product id AND the user id.
        This prevents a user from viewing another user's products
        just by guessing an ID number. Security best practice!

    ---
    Response (200):
        { "product": { "id": 5, "name": "iPhone 15 Pro", ... } }

    Response (404 Not Found):
        { "error": "Product with ID 5 not found" }
    """
    conn    = get_db()
    product = conn.execute(
        "SELECT * FROM products WHERE id = ? AND created_by = ?",
        (product_id, session["user_id"])
    ).fetchone()
    conn.close()

    if not product:
        return jsonify({"error": f"Product with ID {product_id} not found"}), 404

    return jsonify({"product": dict(product)}), 200


# ---- UPDATE (PUT /api/products/<id>) ------------------------
@app.route("/api/products/<int:product_id>", methods=["PUT"])
@login_required
def update_product(product_id):
    """
    Updates an existing product's data.

    HTTP Method : PUT
    URL         : /api/products/5  (where 5 is the product ID)
    Auth needed : Yes

    ---
    What the browser sends (JSON body):
        {
            "name":     "iPhone 15 Pro Max",
            "price":    1299.99,
            "quantity": 30
        }
    You can send ALL fields or only the ones you want to change.

    ---
    PARTIAL UPDATE PATTERN:
        If a field is not included in the request, we keep the old value:
            new_name = data.get("name", existing_product["name"])
        This means: "use new_name from request, OR use the existing name if not provided"

    ---
    SQL EXPLAINED:
        UPDATE products
        SET name=?, description=?, price=?, quantity=?, category=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND created_by=?

        UPDATE        = change existing rows in the table
        SET           = which columns to change and the new values
        WHERE         = which row(s) to update
        CURRENT_TIMESTAMP = SQLite's built-in way to get the current date/time

        IMPORTANT: Always include "WHERE id = ?" so you only update ONE row.
        Without WHERE, you would update EVERY row in the table — a disaster!

    ---
    Response (200):
        { "message": "Product updated successfully!", "product": {...} }

    Response (404):
        { "error": "Product with ID 5 not found" }
    """
    conn    = get_db()
    # First, find the existing product to use as fallback for partial updates
    product = conn.execute(
        "SELECT * FROM products WHERE id = ? AND created_by = ?",
        (product_id, session["user_id"])
    ).fetchone()

    if not product:
        conn.close()
        return jsonify({"error": f"Product with ID {product_id} not found"}), 404

    data = request.get_json()
    if not data:
        conn.close()
        return jsonify({"error": "No data provided. Send JSON with fields to update."}), 400

    # For each field: use the new value if provided, otherwise keep the existing value
    name        = data.get("name",        product["name"]).strip()
    description = data.get("description", product["description"] or "")
    category    = data.get("category",    product["category"])

    try:
        price    = float(data.get("price",    product["price"]))
        quantity = int(data.get("quantity",   product["quantity"]))
    except (ValueError, TypeError):
        conn.close()
        return jsonify({"error": "Price must be a number and quantity must be a whole number"}), 400

    if not name:
        conn.close()
        return jsonify({"error": "Product name cannot be empty"}), 400
    if price < 0:
        conn.close()
        return jsonify({"error": "Price cannot be negative"}), 400
    if quantity < 0:
        conn.close()
        return jsonify({"error": "Quantity cannot be negative"}), 400

    # Run the UPDATE query
    conn.execute(
        """
        UPDATE products
        SET name=?, description=?, price=?, quantity=?, category=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND created_by=?
        """,
        (name, description, price, quantity, category, product_id, session["user_id"])
    )
    conn.commit()   # Save the changes

    # Fetch the updated product to return it in the response
    updated = conn.execute(
        "SELECT * FROM products WHERE id = ?",
        (product_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        "message": "Product updated successfully!",
        "product": dict(updated)
    }), 200


# ---- DELETE (DELETE /api/products/<id>) ---------------------
@app.route("/api/products/<int:product_id>", methods=["DELETE"])
@login_required
def delete_product(product_id):
    """
    Permanently deletes a product from the database.

    HTTP Method : DELETE
    URL         : /api/products/5  (where 5 is the product ID)
    Auth needed : Yes

    Note: DELETE requests do NOT have a request body.
    The product ID is passed in the URL only.

    ---
    What this function does:
        1. Find the product (need the name for the success message)
        2. Check it exists and belongs to this user
        3. Run the DELETE SQL query to remove the row
        4. Return a success message

    ---
    SQL EXPLAINED:
        DELETE FROM products WHERE id=? AND created_by=?

        DELETE FROM = "remove rows from this table"
        WHERE       = "only delete rows that match these conditions"

        CRITICAL: Always include WHERE! Without it, you delete ALL rows in the table!
        We also check created_by so a user can only delete their own products.

    ---
    Response (200):
        { "message": "Product 'iPhone 15 Pro' deleted successfully!" }

    Response (404):
        { "error": "Product with ID 5 not found" }
    """
    conn    = get_db()
    # Fetch the product first — we need its name for the success message
    product = conn.execute(
        "SELECT * FROM products WHERE id=? AND created_by=?",
        (product_id, session["user_id"])
    ).fetchone()

    if not product:
        conn.close()
        return jsonify({"error": f"Product with ID {product_id} not found"}), 404

    product_name = product["name"]   # Save the name before deleting the row

    # Run the DELETE query
    conn.execute(
        "DELETE FROM products WHERE id=? AND created_by=?",
        (product_id, session["user_id"])
    )
    conn.commit()   # Save the change (the deleted row is now gone)
    conn.close()

    return jsonify({
        "message": f"Product '{product_name}' deleted successfully!"
    }), 200


# ---- CATEGORIES (GET /api/categories) -----------------------
@app.route("/api/categories", methods=["GET"])
@login_required
def get_categories():
    """
    Returns all unique product categories used by this user.
    Used to populate the "Filter by Category" dropdown on the dashboard.

    HTTP Method : GET
    URL         : /api/categories
    Auth needed : Yes

    ---
    SQL EXPLAINED:
        SELECT DISTINCT category FROM products WHERE created_by=? ORDER BY category

        DISTINCT = return only unique values (no duplicates)
        Example: if we have 5 Electronics products, DISTINCT gives us
                 "Electronics" only once, not 5 times.

        ORDER BY category = sort alphabetically (A → Z)

    ---
    Response (200):
        { "categories": ["Books", "Electronics", "Footwear"] }
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT category FROM products WHERE created_by=? AND category IS NOT NULL ORDER BY category",
        (session["user_id"],)
    ).fetchall()
    conn.close()

    # Extract just the category string from each row
    categories = [row["category"] for row in rows]

    return jsonify({"categories": categories}), 200


# ==============================================================
# START THE SERVER
# ==============================================================

if __name__ == "__main__":
    """
    This block only runs when you execute this file directly:
        python3 app.py

    It does NOT run when Flask imports this file.

    Steps:
        1. Call init_db() to create tables if they don't exist
        2. Call app.run() to start listening for browser requests

    app.run() parameters:
        debug=True  → auto-restart when you save code changes
                      shows detailed error pages in the browser
                      NEVER use debug=True on a live production server!
        port=5000   → the server listens on port 5000
                      you visit: http://localhost:5000 in your browser
    """
    print("=" * 55)
    print("  Simple CRUD App — Python Flask + SQLite3")
    print("  Learning: Build a product manager step by step")
    print("=" * 55)

    # Create database tables (safe to run multiple times — won't erase data)
    init_db()

    print("[SERVER] Running on http://localhost:5000")
    print("[TIP]    Open your browser and go to http://localhost:5000")
    print("[TIP]    Press CTRL+C to stop the server")
    print()

    # Start the development server
    app.run(debug=True, port=5000)
