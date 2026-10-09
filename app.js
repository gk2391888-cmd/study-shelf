
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
  limit,
  serverTimestamp,
  updateDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { auth, googleProvider, db } from "./firebase-config.js";

const ADMIN_EMAIL = "gaurav.kumar.mail1109@gmail.com";
const CLOUD_NAME = "rjjxdzso";
const UPLOAD_PRESET = "studyshelf_public";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const $ = (id) => document.getElementById(id);

let currentUser = null;
let selectedAssignment = null;
let assignmentsCache = [];
let paymentsCache = [];
let paymentSettings = { upiId: "", qrUrl: "" };

$("year").textContent = new Date().getFullYear();

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function setStatus(message) {
  $("statusMessage").textContent = message;
}

function isAdmin(user = currentUser) {
  return Boolean(
    user &&
    user.emailVerified &&
    user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function resetElement(element) {
  element.replaceChildren();
}

function renderEmpty(container, message) {
  resetElement(container);
  container.append(makeElement("p", "empty-state", message));
}

function setBusy(button, busy, label) {
  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent;
  }
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.originalLabel;
}

async function loginWithGoogle() {
  try {
    $("loginBtn").disabled = true;
    $("heroLoginBtn").disabled = true;
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Google login failed.");
  } finally {
    $("loginBtn").disabled = false;
    $("heroLoginBtn").disabled = false;
  }
}

$("loginBtn").addEventListener("click", loginWithGoogle);
$("heroLoginBtn").addEventListener("click", loginWithGoogle);

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Signed out.");
  } catch (error) {
    console.error(error);
    showToast("Sign out failed.");
  }
});

async function uploadToCloudinary(file, button) {
  if (!file) throw new Error("Please select a file.");

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Maximum file size is 10 MB.");
  }

  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowed.includes(file.type)) {
    throw new Error("Only PDF, JPG, PNG and WebP files are supported.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);

  setBusy(button, true, "Uploading…");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: form }
    );

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      console.error("Cloudinary response:", result);
      throw new Error(result.error?.message || "Cloudinary upload failed.");
    }

    return result;
  } finally {
    setBusy(button, false);
  }
}

async function loadPaymentSettings() {
  try {
    const snapshot = await getDoc(doc(db, "settings", "payments"));

    paymentSettings = snapshot.exists()
      ? {
          upiId: snapshot.data().upiId || "",
          qrUrl: snapshot.data().qrUrl || ""
        }
      : { upiId: "", qrUrl: "" };
  } catch (error) {
    console.error("Payment settings:", error);
    showToast("Payment settings could not load. Check Firestore Rules.");
  }

  renderQr();
}

function renderQr() {
  const qr = $("paymentQrImage");
  const container = $("paymentQrContainer");
  const placeholder = $("paymentQrPlaceholder");

  if (paymentSettings.qrUrl) {
    qr.src = paymentSettings.qrUrl;
    container.classList.remove("hidden");
    placeholder.classList.add("hidden");

    qr.onerror = () => {
      container.classList.add("hidden");
      placeholder.classList.remove("hidden");
    };
  } else {
    qr.removeAttribute("src");
    container.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  if (isAdmin()) {
    $("upiId").value = paymentSettings.upiId;

    if (paymentSettings.qrUrl) {
      $("currentQrImage").src = paymentSettings.qrUrl;
      $("currentQrPreview").classList.remove("hidden");
    } else {
      $("currentQrPreview").classList.add("hidden");
    }
  }

  const help = $("paymentQrPlaceholder").querySelector("p");

  if (help && paymentSettings.upiId) {
    help.textContent =
      `Pay using the displayed QR. UPI ID: ${paymentSettings.upiId}`;
  }
}

async function loadAssignments() {
  try {
    const snapshot = await getDocs(
      query(collection(db, "assignments"), limit(100))
    );

    assignmentsCache = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    $("resourceCount").textContent = String(assignmentsCache.length);
    renderAssignments();
    renderStudentPayments();
  } catch (error) {
    console.error("Assignments:", error);
    renderEmpty(
      $("resourceList"),
      "Assignments could not load. Check Firestore Rules."
    );
  }
}

function approvedFor(assignmentId) {
  return paymentsCache.some(
    (payment) =>
      payment.assignmentId === assignmentId &&
      payment.status === "approved"
  );
}

// NEW: Admin-only assignment deletion
async function deleteAssignment(assignment) {
  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  const confirmed = window.confirm(
    `Delete "${assignment.title || "this assignment"}"?\n\n` +
    "It will be removed from the StudyShelf assignment list. " +
    "Existing payment history will be preserved."
  );

  if (!confirmed) return;

  const buttons = [
    ...$("resourceList").querySelectorAll("button[data-delete-id]")
  ];

  const deleteButton = buttons.find(
    (button) => button.dataset.deleteId === assignment.id
  );

  if (deleteButton) setBusy(deleteButton, true, "Deleting…");

  try {
    await deleteDoc(doc(db, "assignments", assignment.id));

    assignmentsCache = assignmentsCache.filter(
      (item) => item.id !== assignment.id
    );

    if (selectedAssignment?.id === assignment.id) {
      selectedAssignment = null;
      $("paymentSection").classList.add("hidden");
    }

    $("resourceCount").textContent = String(assignmentsCache.length);

    renderAssignments();
    renderStudentPayments();

    showToast("Assignment deleted successfully.");
  } catch (error) {
    console.error("Delete assignment:", error);
    showToast("Could not delete assignment. Check Firestore Rules.");
    await loadAssignments();
  }
}

function renderAssignments() {
  const container = $("resourceList");
  resetElement(container);

  if (!assignmentsCache.length) {
    renderEmpty(container, "No assignments published yet.");
    return;
  }

  for (const assignment of assignmentsCache) {
    const card = makeElement("article", "resource-item");

    card.append(
      makeElement("h3", "", assignment.title || "Assignment")
    );

    card.append(
      makeElement("p", "", assignment.subject || "General")
    );

    if (assignment.description) {
      card.append(makeElement("p", "", assignment.description));
    }

    card.append(
      makeElement(
        "p",
        "resource-price",
        `Price: ₹${Number(assignment.price) || 0}`
      )
    );

    if (approvedFor(assignment.id) && assignment.fileUrl) {
      const download = makeElement(
        "a",
        "btn btn-primary",
        "Open assignment"
      );

      download.href = assignment.fileUrl;
      download.target = "_blank";
      download.rel = "noopener noreferrer";
      card.append(download);
    } else {
      const button = makeElement(
        "button",
        "btn btn-primary",
        "Pay / View status"
      );

      button.type = "button";
      button.addEventListener("click", () => openPayment(assignment));
      card.append(button);
    }

    // Delete button is visible only to the authorized admin.
    if (isAdmin()) {
      const deleteButton = makeElement(
        "button",
        "btn btn-outline",
        "Delete Assignment"
      );

      deleteButton.type = "button";
      deleteButton.dataset.deleteId = assignment.id;
      deleteButton.style.marginTop = "10px";
      deleteButton.style.borderColor = "#dc2626";
      deleteButton.style.color = "#dc2626";

      deleteButton.addEventListener("click", () => {
        deleteAssignment(assignment);
      });

      card.append(deleteButton);
    }

    container.append(card);
  }
}

function openPayment(assignment) {
  selectedAssignment = assignment;

  $("selectedAssignmentText").textContent =
    `${assignment.title || "Assignment"} · ${assignment.subject || "General"}`;

  $("paymentAmount").textContent =
    `₹${Number(assignment.price) || 0}`;

  $("paymentSection").classList.remove("hidden");
  renderQr();

  $("paymentSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function loadStudentPayments() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "payments"),
        where("userId", "==", currentUser.uid),
        limit(100)
      )
    );

    paymentsCache = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    $("pendingCount").textContent = String(
      paymentsCache.filter(
        (payment) => payment.status === "pending"
      ).length
    );

    renderStudentPayments();
    renderAssignments();
  } catch (error) {
    console.error("Payment history:", error);
    renderEmpty(
      $("studentPaymentList"),
      "Payment history could not load."
    );
  }
}

function renderStudentPayments() {
  const container = $("studentPaymentList");
  resetElement(container);

  if (!paymentsCache.length) {
    renderEmpty(container, "No payment requests yet.");
    return;
  }

  for (const payment of paymentsCache) {
    const card = makeElement("article", "resource-item");

    card.append(
      makeElement("h3", "", payment.assignmentTitle || "Assignment")
    );

    card.append(
      makeElement("p", "", `UTR: ${payment.transactionId || "—"}`)
    );

    card.append(
      makeElement("p", "", `Amount: ₹${Number(payment.amount) || 0}`)
    );

    card.append(
      makeElement("p", "", `Status: ${payment.status || "pending"}`)
    );

    const assignment = assignmentsCache.find(
      (item) => item.id === payment.assignmentId
    );

    if (payment.status === "approved" && assignment?.fileUrl) {
      const link = makeElement(
        "a",
        "btn btn-primary",
        "Open assignment"
      );

      link.href = assignment.fileUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.append(link);
    }

    container.append(card);
  }
}

async function submitPayment(event) {
  event.preventDefault();

  if (!currentUser || !selectedAssignment) {
    showToast("Select an assignment first.");
    return;
  }

  const transactionId = $("transactionId").value.trim();
  const amount = Number(selectedAssignment.price);

  if (transactionId.length < 6 || transactionId.length > 100) {
    showToast("Enter a valid transaction ID / UTR.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("Invalid assignment price.");
    return;
  }

  const button = $("submitPaymentBtn");

  try {
    setBusy(button, true, "Submitting…");

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
    setStatus("Your payment is pending manual verification.");

    await loadStudentPayments();
  } catch (error) {
    console.error("Payment submission:", error);
    showToast("Payment submission failed. Check Firestore Rules.");
  } finally {
    setBusy(button, false);
  }
}

$("paymentForm").addEventListener("submit", submitPayment);

async function loadAdminPayments() {
  if (!isAdmin()) return;

  const container = $("adminPaymentList");
  resetElement(container);

  try {
    const snapshot = await getDocs(
      query(collection(db, "payments"), limit(100))
    );

    const requests = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    if (!requests.length) {
      renderEmpty(container, "No payment requests yet.");
      return;
    }

    for (const payment of requests) {
      const card = makeElement("article", "resource-item");

      card.append(
        makeElement("h3", "", payment.assignmentTitle || "Assignment")
      );

      card.append(
        makeElement("p", "", `Student UID: ${payment.userId || "—"}`)
      );

      card.append(
        makeElement("p", "", `UTR: ${payment.transactionId || "—"}`)
      );

      card.append(
        makeElement("p", "", `Amount: ₹${Number(payment.amount) || 0}`)
      );

      card.append(
        makeElement("p", "", `Status: ${payment.status || "pending"}`)
      );

      if (payment.status === "pending") {
        const approve = makeElement(
          "button",
          "btn btn-primary",
          "Approve"
        );

        approve.type = "button";
        approve.addEventListener("click", () => {
          reviewPayment(payment.id, "approved");
        });

        const reject = makeElement(
          "button",
          "btn btn-outline",
          "Reject"
        );

        reject.type = "button";
        reject.addEventListener("click", () => {
          reviewPayment(payment.id, "rejected");
        });

        card.append(approve, reject);
      }

      container.append(card);
    }
  } catch (error) {
    console.error("Admin payment list:", error);
    renderEmpty(
      container,
      "Could not load payments. Check Firestore Rules."
    );
  }
}

async function reviewPayment(paymentId, status) {
  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  const confirmed = window.confirm(
    status === "approved"
      ? "Verify that this payment has actually arrived in your UPI/bank account. Approve?"
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
    await loadStudentPayments();
  } catch (error) {
    console.error("Review payment:", error);
    showToast("Could not update status. Check Firestore Rules.");
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

  const title = $("assignmentTitle").value.trim();
  const subject = $("assignmentSubject").value.trim();
  const description = $("assignmentDescription").value.trim();
  const price = Number($("assignmentPrice").value);
  const file = $("assignmentFile").files[0];
  const button = $("publishAssignmentBtn");

  if (!title || !subject || !file || !Number.isFinite(price) || price <= 0) {
    showToast("Complete all required fields.");
    return;
  }

  try {
    const uploaded = await uploadToCloudinary(file, button);

    await addDoc(collection(db, "assignments"), {
      title,
      subject,
      description,
      price,
      fileUrl: uploaded.secure_url,
      filePublicId: uploaded.public_id,
      fileType: uploaded.resource_type,
      fileFormat: uploaded.format || "",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    $("assignmentForm").reset();

    showToast("Assignment published.");
    await loadAssignments();
  } catch (error) {
    console.error("Assignment publishing:", error);
    showToast(error.message || "Could not publish assignment.");
  }
});

$("paymentSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isAdmin()) {
    showToast("Admin access required.");
    return;
  }

  const upiId = $("upiId").value.trim();
  const file = $("qrFile").files[0];
  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );

  if (
    upiId &&
    !/^[\w.-]{2,256}@[a-zA-Z0-9.-]{2,64}$/.test(upiId)
  ) {
    showToast("Enter a valid UPI ID.");
    return;
  }

  try {
    setBusy(button, true, "Saving…");

    let qrUrl = paymentSettings.qrUrl;

    if (file) {
      const uploaded = await uploadToCloudinary(file, button);
      qrUrl = uploaded.secure_url;
    }

    if (!upiId && !qrUrl) {
      showToast("Enter a UPI ID or upload a QR image.");
      return;
    }

    await setDoc(doc(db, "settings", "payments"), {
      upiId,
      qrUrl,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.email
    });

    paymentSettings = { upiId, qrUrl };

    renderQr();
    $("qrFile").value = "";

    showToast("Payment settings saved.");
  } catch (error) {
    console.error("Saving payment settings:", error);
    showToast(error.message || "Could not save settings. Check Firestore Rules.");
  } finally {
    setBusy(button, false);
  }
});

function headerUserToggle(user) {
  $("headerUser").textContent =
    user.displayName || user.email || "Signed in";

  $("headerUser").classList.remove("hidden");
}

async function startDashboard(user) {
  currentUser = user;

  $("loginBtn").textContent = "My Account";
  headerUserToggle(user);

  $("studentName").textContent = user.displayName || "Student";
  $("studentEmail").textContent = user.email || "";

  $("accountSection").classList.remove("hidden");
  $("heroLoginBtn").classList.add("hidden");
  $("paymentSection").classList.add("hidden");
  $("adminSection").classList.toggle("hidden", !isAdmin(user));

  setStatus(
    isAdmin(user)
      ? "Admin signed in. Verify payments before approving."
      : "Welcome! All assignments are paid resources."
  );

  await loadPaymentSettings();
  await loadAssignments();
  await loadStudentPayments();

  if (isAdmin(user)) {
    await loadAdminPayments();
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    $("loginBtn").textContent = "Sign in with Google";
    $("headerUser").classList.add("hidden");
    $("accountSection").classList.add("hidden");
    $("heroLoginBtn").classList.remove("hidden");
    $("adminSection").classList.add("hidden");
    $("paymentSection").classList.add("hidden");
    return;
  }

  try {
    await startDashboard(user);
  } catch (error) {
    console.error("Dashboard startup:", error);
    setStatus("Dashboard could not finish loading. Check Firestore Rules.");
    showToast("Dashboard initialization failed.");
  }
});
