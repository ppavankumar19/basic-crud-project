/**
 * auth.js  —  Login and Register Logic
 * ======================================
 * This file runs in the browser (not on the server).
 * It handles the Login and Register forms on index.html.
 *
 * ---------------------------------------------------------------
 * HOW THE FRONTEND AND BACKEND ARE CONNECTED
 * ---------------------------------------------------------------
 * The frontend (this JS file) and backend (Flask / app.py) are
 * two completely separate programs. They communicate using HTTP:
 *
 *   1. User clicks "Sign In"
 *   2. This JS file collects the email and password from the form
 *   3. This JS file uses fetch() to send the data to Flask:
 *         POST http://localhost:5000/api/auth/login
 *         Body: { "email": "john@...", "password": "abc123" }
 *   4. Flask receives the request, checks the database
 *   5. Flask sends back a JSON response:
 *         { "message": "Login successful!", "user": {...} }
 *   6. This JS file reads the response and redirects to dashboard
 *
 *   Browser JS (frontend)   ----HTTP POST---->  Flask Python (backend)
 *   Browser JS (frontend)   <----JSON resp----  Flask Python (backend)
 *
 * ---------------------------------------------------------------
 * WHAT IS fetch()?
 * ---------------------------------------------------------------
 * fetch() is a JavaScript built-in function that sends HTTP
 * requests to a server and waits for the response.
 *
 * Basic structure:
 *     const response = await fetch("http://localhost:5000/api/auth/login", {
 *         method: "POST",                          // HTTP method
 *         headers: { "Content-Type": "application/json" }, // telling server we're sending JSON
 *         body: JSON.stringify({ email, password }) // the data we're sending (as JSON text)
 *     });
 *     const data = await response.json();  // read the JSON response from the server
 *
 * ---------------------------------------------------------------
 * WHAT IS async / await?
 * ---------------------------------------------------------------
 * Sending a request to a server takes TIME (the data travels over
 * the network). We don't want the browser to freeze while waiting.
 *
 * async/await solves this:
 *   - async means "this function does something that takes time"
 *   - await means "pause here and wait for this to finish"
 *
 * Think of it like ordering food at a restaurant:
 *   - You place the order (fetch)
 *   - You wait for the food (await)
 *   - The food arrives (the response)
 *   - You eat it (use the data)
 *
 * ---------------------------------------------------------------
 * WHAT IS JSON?
 * ---------------------------------------------------------------
 * JSON is a simple text format for sending data.
 * It looks like a JavaScript object:
 *   { "email": "john@example.com", "password": "abc123" }
 *
 *   JSON.stringify(object) → converts JS object TO a JSON string
 *   response.json()        → converts a JSON string BACK to a JS object
 *
 * ---------------------------------------------------------------
 * API ENDPOINTS USED IN THIS FILE:
 * ---------------------------------------------------------------
 *   POST /api/auth/register  →  Create a new user account
 *   POST /api/auth/login     →  Login and get a session cookie
 *   GET  /api/auth/me        →  Check if user is already logged in
 */


// ---------------------------------------------------------------
// BASE URL
// ---------------------------------------------------------------
// Empty string "" means "same server" — the frontend and backend
// run on the same server (http://localhost:5000).
// So "/api/auth/login" becomes "http://localhost:5000/api/auth/login"
const API_BASE = "";


// ---------------------------------------------------------------
// PAGE LOAD — Check if user is already logged in
// ---------------------------------------------------------------

/**
 * This code runs automatically when the page finishes loading.
 * "DOMContentLoaded" means "the HTML has been fully loaded and parsed".
 *
 * WHY DO WE CHECK IF ALREADY LOGGED IN?
 * If the user is already logged in (they have a session cookie),
 * we should skip the login page and take them straight to the dashboard.
 * We call GET /api/auth/me to check — if it returns OK (200), they're logged in.
 *
 * HOW COOKIES WORK (simple explanation):
 * After logging in, Flask stores a small text file called a "cookie"
 * in the browser. Every time the browser makes a request to our server,
 * it automatically sends this cookie along. Flask reads the cookie to
 * know who is logged in.
 *
 * credentials: "include" — this tells fetch() to send the cookie.
 * Without it, the browser would not send the cookie, and Flask would
 * not know the user is logged in.
 */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: "include"   // send the session cookie with this request
    });

    if (res.ok) {
      // res.ok is true when the server returned status 200-299
      // If /api/auth/me returned OK, the user is already logged in
      window.location.href = "/dashboard";   // send them to the dashboard
    }
    // If res.ok is false (e.g. 401 Unauthorized), the user is not logged in.
    // We do nothing — they stay on the login page.

  } catch (err) {
    // This catch block runs if the server is completely unreachable
    // (e.g. Flask is not running). We just stay on the login page.
    console.log("Backend not reachable:", err.message);
  }
});


// ---------------------------------------------------------------
// TAB SWITCHING  (Login tab ↔ Register tab)
// ---------------------------------------------------------------

/**
 * Switches between the Login and Register tabs.
 *
 * @param {"login" | "register"} tab — which tab to show
 *
 * HOW IT WORKS:
 * The two forms are both in the HTML but one is hidden.
 * We toggle the CSS class "hidden" (display: none) to show/hide them.
 * We also toggle the CSS class "active" on the tab buttons
 * to show which tab is selected (for styling purposes).
 *
 * DOM MANIPULATION:
 * "DOM" stands for Document Object Model — it's the browser's
 * representation of the HTML page.
 * document.getElementById("loginTab")  → finds the element with id="loginTab"
 * .classList.add("active")             → adds the CSS class "active" to it
 * .classList.remove("hidden")          → removes the CSS class "hidden" from it
 */
function switchTab(tab) {
  const loginTab     = document.getElementById("loginTab");
  const registerTab  = document.getElementById("registerTab");
  const loginForm    = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  if (tab === "login") {
    // Show Login tab and form
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginForm.classList.remove("hidden");    // Show login form
    registerForm.classList.add("hidden");    // Hide register form
  } else {
    // Show Register tab and form
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerForm.classList.remove("hidden"); // Show register form
    loginForm.classList.add("hidden");       // Hide login form
  }

  // Clear any leftover error messages when switching tabs
  hideAlert("loginError");
  hideAlert("registerError");
  hideAlert("registerSuccess");
}


// ---------------------------------------------------------------
// REGISTER  (Create a new account)
// ---------------------------------------------------------------

/**
 * Handles the Register form submission.
 *
 * @param {Event} event — the browser's form submit event
 *
 * STEP BY STEP:
 *   1. event.preventDefault() — stop the form from doing a normal page refresh
 *   2. Read the values the user typed in the form inputs
 *   3. Validate on the frontend (check password length, etc.)
 *   4. Send a POST request to /api/auth/register with the data
 *   5. If success: show a success message and switch to Login tab
 *   6. If error: show the error message from the server
 *
 * WHY event.preventDefault()?
 * Normally when you submit an HTML form, the browser refreshes
 * the entire page and sends the data to a server. We don't want
 * that — we want to handle the submission ourselves with fetch().
 * preventDefault() stops the default browser behavior.
 *
 * WHY DO WE VALIDATE ON THE FRONTEND?
 * Frontend validation (in JS) gives instant feedback to the user
 * without needing to contact the server. It improves user experience.
 * However, the backend ALSO validates the same data, because anyone
 * can bypass frontend validation (e.g. using browser dev tools).
 * Never trust only frontend validation for security!
 */
async function handleRegister(event) {
  event.preventDefault();   // Stop the form from refreshing the page

  const btn = document.getElementById("registerBtn");

  // Read the values the user typed into the input fields
  const username = document.getElementById("regUsername").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  // .value      → gets the current text in the input box
  // .trim()     → removes spaces from start and end (e.g. "  john  " → "john")

  // --- Frontend Validation ---
  // Check before even sending to the server (for instant feedback)
  if (password.length < 6) {
    showAlert("registerError", "Password must be at least 6 characters long");
    return;   // Stop here — don't send the request
  }

  // Show loading state on the button (so user knows something is happening)
  setLoading(btn, true, "Creating account...");
  hideAlert("registerError");
  hideAlert("registerSuccess");

  try {
    /**
     * Send a POST request to the Flask backend.
     *
     * fetch() breakdown:
     *   URL: "/api/auth/register"
     *     → Since API_BASE is "", this becomes "/api/auth/register"
     *     → The browser adds the domain: "http://localhost:5000/api/auth/register"
     *
     *   method: "POST"
     *     → We're CREATING new data (POST is the HTTP method for creating)
     *
     *   headers: { "Content-Type": "application/json" }
     *     → Tells the server: "I'm sending data in JSON format"
     *     → Without this, Flask doesn't know how to read the body
     *
     *   credentials: "include"
     *     → Send the session cookie (if any) with this request
     *     → Required for session/cookie-based authentication to work
     *
     *   body: JSON.stringify({ username, email, password })
     *     → Convert our JavaScript object to a JSON string for sending
     *     → { username, email, password } is shorthand for:
     *       { username: username, email: email, password: password }
     */
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body:        JSON.stringify({ username, email, password })
    });

    // Parse the JSON response from the server
    // (the server returns JSON, we convert it back to a JS object)
    const data = await res.json();

    if (res.ok) {
      // Success! (status code 201 Created)
      showAlert("registerSuccess", "Account created! You can now login.");
      // Clear the form inputs
      document.getElementById("regUsername").value = "";
      document.getElementById("regEmail").value    = "";
      document.getElementById("regPassword").value = "";
      // Wait 1.5 seconds then switch to the login tab
      setTimeout(() => switchTab("login"), 1500);

    } else {
      // Server returned an error (e.g. 400 Bad Request or 409 Conflict)
      // data.error contains the error message from Flask
      showAlert("registerError", data.error || "Registration failed. Please try again.");
    }

  } catch (err) {
    // This runs if the network request completely failed
    // (e.g. Flask is not running, internet is down)
    showAlert("registerError", "Cannot connect to the server. Is the backend running?");
    console.error("Register error:", err);
  } finally {
    // "finally" always runs — even if there was an error.
    // Re-enable the button so the user can try again.
    setLoading(btn, false, "Create Account");
  }
}


// ---------------------------------------------------------------
// LOGIN  (Sign into an existing account)
// ---------------------------------------------------------------

/**
 * Handles the Login form submission.
 *
 * @param {Event} event — the browser's form submit event
 *
 * STEP BY STEP:
 *   1. Read email and password from the form
 *   2. Send POST /api/auth/login to the Flask backend
 *   3. Flask checks the database, verifies the password
 *   4. Flask creates a SESSION COOKIE (how it "remembers" you)
 *   5. If success: redirect to the dashboard page
 *   6. If error: show the error message
 *
 * WHAT IS A SESSION COOKIE?
 * -------------------------
 * Think of a session cookie like a wristband at an amusement park.
 * When you pay (login), you get a wristband (cookie).
 * Every time you go on a ride (make a request), you show the
 * wristband instead of paying again. When you leave (logout),
 * the wristband is taken off (cookie is cleared).
 *
 * Flask creates the cookie automatically when we set:
 *   session["user_id"] = 1   (in app.py)
 *
 * The browser stores it and sends it back on every future request.
 * Flask reads it to know who is making the request.
 *
 * HTTP RESPONSE CODES:
 * 200 OK          → login worked
 * 401 Unauthorized → wrong email or password
 * 400 Bad Request → missing fields
 */
async function handleLogin(event) {
  event.preventDefault();   // Stop the form from refreshing the page

  const btn      = document.getElementById("loginBtn");
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  // Show loading state
  setLoading(btn, true, "Signing in...");
  hideAlert("loginError");

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",   // Required: allows the session cookie to be set
      body:        JSON.stringify({ email, password })
    });

    const data = await res.json();   // Read the JSON response from Flask

    if (res.ok) {
      // Login successful!
      // Flask has set the session cookie in the browser.
      // Now we redirect the browser to the dashboard page.
      window.location.href = "/dashboard";
      // After this redirect, every request to Flask will include
      // the session cookie, so Flask knows we're logged in.

    } else {
      // Login failed — show the error message from the server
      showAlert("loginError", data.error || "Login failed. Please check your email and password.");
    }

  } catch (err) {
    // Network error — Flask might not be running
    showAlert("loginError", "Cannot connect to the server. Is the backend running?");
    console.error("Login error:", err);
  } finally {
    setLoading(btn, false, "Sign In");
  }
}


// ---------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------

/**
 * Shows an alert (error or success message) inside the form.
 *
 * @param {string} id      — the HTML element's id (e.g. "loginError")
 * @param {string} message — the text to display inside the alert box
 *
 * HOW IT WORKS:
 * In the HTML, we have hidden divs like:
 *   <div class="alert alert-error" id="loginError" style="display:none;"></div>
 *
 * This function fills in the text and makes the div visible.
 * The CSS class "alert alert-error" gives it a red background.
 */
function showAlert(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent   = message;     // Set the message text
    el.style.display = "block";     // Make the div visible (removes display:none)
  }
}

/**
 * Hides an alert box (makes it invisible).
 *
 * @param {string} id — the HTML element's id to hide
 */
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = "none";   // Hide the div again
    el.textContent   = "";       // Clear the message text
  }
}

/**
 * Sets a button to loading state (disabled + new label) or normal state.
 *
 * @param {HTMLButtonElement} btn     — the button element to modify
 * @param {boolean}           loading — true = loading state, false = normal
 * @param {string}            label   — the button text to show
 *
 * WHY DO WE DISABLE THE BUTTON DURING LOADING?
 * To prevent the user from clicking "Sign In" multiple times and
 * sending multiple requests to the server. We re-enable it in
 * the "finally" block after the request finishes (success or error).
 */
function setLoading(btn, loading, label) {
  btn.disabled    = loading;   // true = button is greyed out and unclickable
  btn.textContent = label;     // Change the button text
}
