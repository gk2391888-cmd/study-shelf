
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { auth, googleProvider, db } from "./firebase-config.js";

const ADMIN_EMAIL = "gaurav.kumar.mail1109@gmail.com";

const $ = (id) => document.getElementById(id);

const loginBtn = $("loginBtn");
const heroLoginBtn = $("heroLoginBtn");
const logoutBtn = $("logoutBtn");
const accountSection = $("accountSection");
const adminSection = $("adminSection");
const studentName = $("studentName");
const studentEmail = $("studentEmail");
const statusMessage = $("statusMessage");
const resourceList = $("resourceList");
const toast = $("toast");
const paymentSection = $("paymentSection");

let currentUser = null;
let selectedAssignment = null;
let assignmentsCache = [];
let paymentsCache = [];
let paymentSettings = { upiId: "", qrUrl: "" };

$("year").textContent = new Date().getFullYear();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function setStatus(message) {
  statusMessage.textContent = message;
}

function isAdmin(user = currentUser) {
  return Boolean(
    user &&
    user.emailVerified &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function loginWithGoogle() {
  try {
    loginBtn.disabled = true;
    heroLoginBtn.disabled = true;
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login error:", error);
    showToast(error.message || "Google sign-in failed.");
  } finally {
    loginBtn.disabled = false;
    heroLoginBtn.disabled = false;
  }
}

loginBtn.addEventListener("click", loginWithGoogle);
heroLoginBtn.addEventListener("click", loginWithGoogle);

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Signed out successfully.");
  } catch (error) {
    console.error(error);
    showToast("Sign out failed.");
  }
});

function resetElement(element) {
  element.replaceChildren();
}

function renderEmpty(container, message) {
  resetElement(container);
  container.append(makeElement("p", "empty-state", message));
}

async function loadPaymentSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "payments"));
    if (snap.exists()) {
      const data = snap.data();
      paymentSettings = {
        upiId: typeof data.upiId === "string" ? data.upiId : "",
        qrUrl: typeof data.qrUrl === "string" ? data.qrUrl : ""
      };
    }
  } catch (error) {
    console.error("Payment settings could not be loaded:", error);
  }

  renderQr();
}

function renderQr() {
  const image = $("paymentQrImage");
  const container = $("paymentQrContainer");
  const placeholder = $("paymentQrPlaceholder");

  if (paymentSettings.qrUrl) {
    image.src = paymentSettings.qrUrl;
    container.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else {
    image.removeAttribute("src");
    container.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  if (isAdmin()) {
    $("upiId").value = paymentSettings.upiId || "";
    if (paymentSettings.qrUrl) {
      $("currentQrImage").src = paymentSettings.qrUrl;
      $("currentQrPreview").classList.remove("hidden");
    }
  }
}

async function loadAssignments() {
  try {
    const snap = await getDocs(
      query(collection(db, "assignments"), limit(100))
    );

    assignmentsCache = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    renderAssignments();
    $("resourceCount").textContent = String(assignmentsCache.length);
  } catch (error) {
    console.error("Assignments load error:", error);
    renderEmpty(resourceList, "Could not load assignments. Check Firestore Rules.");
    setStatus("Assignments could not be loaded. Check the browser console and Firestore Rules.");
  }
}

function renderAssignments() {
  resetElement(resourceList);

  if (!assignmentsCache.length) {
    renderEmpty(resourceList, "No assignments published yet.");
    return;
  }

  for (const item of assignmentsCache) {
    const card = makeElement("article", "resource-item");
    card.append(makeElement("h3", "", item.title || "Untitled assignment"));
    card.append(makeElement("p", "", item.subject || "General"));
    if (item.description) {
      card.append(makeElement("p", "", item.description));
    }

    const price = Number(item.price);
    card.append(makeElement(
      "p",
      "resource-price",
      Number.isFinite(price) ? `Price: ₹${price}` : "Price unavailable"
    ));

    const button = makeElement("button", "btn btn-primary", "Pay / View status");
    button.type = "button";
    button.addEventListener("click", () => openPayment(item));
    card.append(button);

    resourceList.append(card);
  }
}

function openPayment(item) {
  selectedAssignment = item;
  $("selectedAssignmentText").textContent =
    `${item.title || "Assignment"} · ${item.subject || "General"}`;
  $("paymentAmount").textContent = `₹${Number(item.price) || 0}`;
  paymentSection.classList.remove("hidden");
  paymentSection.scrollIntoView({ behavior: "smooth", block: "start" });
  renderQr();
}

async function loadStudentPayments() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "payments"),
        where("userId", "==", currentUser.uid),
        limit(100)
      )
    );

    paymentsCache = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    $("pendingCount").textContent = String(
      paymentsCache.filter((p) => p.status === "pending").length
    );

    renderStudentPayments();
  } catch (error) {
    console.error("Payment history error:", error);
    renderEmpty($("studentPaymentList"), "Payment history could not be loaded.");
  }
}

function renderStudentPayments() {
  const container = $("studentPaymentList");
  resetElement(container);

  if (!paymentsCache.length) {
    renderEmpty(container, "You have not submitted any payment requests yet.");
    return;
  }

  for (const payment of paymentsCache) {
    const card = makeElement("article", "resource-item");
    card.append(makeElement("h3", "", payment.assignmentTitle || "Assignment payment"));
    card.append(makeElement("p", "", `Transaction ID: ${payment.transactionId || "—"}`));
    card.append(makeElement("p", "", `Amount: ₹${Number(payment.amount) || 0}`));
    card.append(makeElement("p", "", `Status: ${payment.status || "pending"}`));

    if (payment.status === "approved") {
      card.append(makeElement(
        "p",
        "",
        "Payment approved. File access still depends on secure file delivery being configured."
      ));
    }
    container.append(card);
  }
}

async function submitPayment(event) {
  event.preventDefault();

  if (!currentUser || !selectedAssignment) {
    showToast("Please select an assignment first.");
    return;
  }

  const transactionId = $("transactionId").value.trim();
  const amount = Number(selectedAssignment.price);

  if (transactionId.length < 6 || transactionId.length > 100) {
    showToast("Enter a valid transaction ID / UTR.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("This assignment has an invalid price.");
    return;
  }

  $("submitPaymentBtn").disabled = true;

  try {
    await addDoc(collection(db, "payments"), {
      userId: currentUser.uid,
      assignmentId: selectedAssignment.id,
      assignmentTitle: String(selectedAssignment.title || "Assignment"),
      transactionId,
      amount,
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("paymentForm").reset();
    showToast("Payment request submitted for verification.");
    setStatus("Payment request submitted. Your resource will remain locked until the administrator verifies the payment.");
    await loadStudentPayments();
  } catch (error) {
    console.error("Payment submission error:", error);
    showToast("Could not submit payment. Check Firestore Rules.");
  } finally {
    $("submitPaymentBtn").disabled = false;
  }
}

$("paymentForm").addEventListener("submit", submitPayment);

async function loadAdminPayments() {
  if (!isAdmin()) return;

  const container = $("adminPaymentList");
  resetElement(container);

  try {
    const snap = await getDocs(
      query(collection(db, "payments"), limit(100))
    );

    const requests = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    if (!requests.length) {
      renderEmpty(container, "No payment requests yet.");
      return;
    }

    for (const payment of requests) {
      const card = makeElement("article", "resource-item");
      card.append(makeElement("h3", "", payment.assignmentTitle || "Assignment payment"));
      card.append(makeElement("p", "", `Student UID: ${payment.userId || "—"}`));
      card.append(makeElement("p", "", `Transaction ID: ${payment.transactionId || "—"}`));
      card.append(makeElement("p", "", `Amount: ₹${Number(payment.amount) || 0}`));
      card.append(makeElement("p", "", `Status: ${payment.status || "pending"}`));

      if (payment.status === "pending") {
        const approve = makeElement("button", "btn btn-primary", "Approve");
        approve.type = "button";
        approve.addEventListener("click", () => reviewPayment(payment.id, "approved"));

        const reject = makeElement("button", "btn btn-outline", "Reject");
        reject.type = "button";
        reject.addEventListener("click", () => reviewPayment(payment.id, "rejected"));

        card.append(approve, reject);
      }

      container.append(card);
    }
  } catch (error) {
    console.error("Admin payments error:", error);
    renderEmpty(container, "Could not load requests. Check Firestore Rules.");
  }
}

async function reviewPayment(paymentId, status) {
  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  const confirmed = window.confirm(
    status === "approved"
      ? "Have you verified this payment in your UPI app or bank statement?"
      : "Reject this payment request?"
  );

  if (!confirmed) return;

  try {
    await updateDoc(doc(db, "payments", paymentId), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.email
    });

    showToast(`Payment ${status}.`);
    await loadAdminPayments();
  } catch (error) {
    console.error("Payment review error:", error);
    showToast("Could not update payment. Check Firestore Rules.");
  }
}

$("showUploadBtn").addEventListener("click", () => {
  $("adminUploadPanel").classList.remove("hidden");
  $("adminPaymentsPanel").classList.add("hidden");
  $("adminSettingsPanel").classList.add("hidden");
});

$("showPaymentsBtn").addEventListener("click", async () => {
  $("adminUploadPanel").classList.add("hidden");
  $("adminPaymentsPanel").classList.remove("hidden");
  $("adminSettingsPanel").classList.add("hidden");
  await loadAdminPayments();
});

$("showSettingsBtn").addEventListener("click", () => {
  $("adminUploadPanel").classList.add("hidden");
  $("adminPaymentsPanel").classList.add("hidden");
  $("adminSettingsPanel").classList.remove("hidden");
});

$("assignmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  showToast("Assignment publishing is disabled until secure file upload and delivery are configured.");
});

$("paymentSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  showToast("QR/UPI settings are not saved yet. A protected admin-only settings write path must be configured first.");
});

async function startDashboard(user) {
  currentUser = user;
  const admin = isAdmin(user);

  loginBtn.textContent = "My Account";
  headerUserToggle(user);
  studentName.textContent = user.displayName || "Student";
  studentEmail.textContent = user.email || "";
  accountSection.classList.remove("hidden");
  heroLoginBtn.classList.add("hidden");
  paymentSection.classList.add("hidden");
  adminSection.classList.toggle("hidden", !admin);

  setStatus(admin
    ? "Signed in as administrator. Verify every payment before approving it."
    : "Login successful. All assignments are paid resources; access requires verified payment.");

  await loadPaymentSettings();
  await loadAssignments();
  await loadStudentPayments();

  if (admin) {
    await loadAdminPayments();
  }
}

function headerUserToggle(user) {
  $("headerUser").textContent = user.displayName || user.email || "Signed in";
  $("headerUser").classList.remove("hidden");
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    loginBtn.textContent = "Sign in with Google";
    $("headerUser").classList.add("hidden");
    accountSection.classList.add("hidden");
    heroLoginBtn.classList.remove("hidden");
    adminSection.classList.add("hidden");
    paymentSection.classList.add("hidden");
    resetElement(resourceList);
    return;
  }

  try {
    await startDashboard(user);
  } catch (error) {
    console.error("Dashboard initialization error:", error);
    setStatus("Your account is signed in, but the dashboard could not finish loading. Check Firestore Rules.");
    showToast("Dashboard initialization failed.");
  }
});
