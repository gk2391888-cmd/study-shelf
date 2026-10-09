import {
signInWithPopup,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { auth, googleProvider } from "./firebase-config.js";

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = "rijxdzso";
const CLOUDINARY_UPLOAD_PRESET = "studyshelf_public";

const loginBtn = document.getElementById("loginBtn");
const heroLoginBtn = document.getElementById("heroLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const accountSection = document.getElementById("accountSection");
const studentName = document.getElementById("studentName");
const studentEmail = document.getElementById("studentEmail");
const statusMessage = document.getElementById("statusMessage");
const resourceList = document.getElementById("resourceList");
const toast = document.getElementById("toast");

document.getElementById("year").textContent = new Date().getFullYear();

function showToast(message) {
if (!toast) return;
toast.textContent = message;
toast.classList.add("show");
setTimeout(() => toast.classList.remove("show"), 3500);
}

async function loginWithGoogle() {
try {
loginBtn.disabled = true;
heroLoginBtn.disabled = true;
await signInWithPopup(auth, googleProvider);
} catch (error) {
console.error("Google sign-in error:", error);
showToast(error.message || "Google login failed.");
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
console.error("Sign-out error:", error);
showToast("Sign out failed.");
}
});

onAuthStateChanged(auth, (user) => {
if (user) {
loginBtn.textContent = "My Account";
studentName.textContent = user.displayName || "Student";
studentEmail.textContent = user.email || "";
accountSection.classList.remove("hidden");
heroLoginBtn.classList.add("hidden");

```
statusMessage.textContent =
  "Login successful! Your StudyShelf account is ready.";

resourceList.replaceChildren();

const card = document.createElement("article");
card.className = "resource-item";

const title = document.createElement("h3");
title.textContent = "Welcome to StudyShelf";

const description = document.createElement("p");
description.textContent =
  "Your account is active. Assignment listings, payments and secure access will be connected in the next steps.";

card.append(title, description);
resourceList.append(card);
```

} else {
loginBtn.textContent = "Sign in with Google";
accountSection.classList.add("hidden");
heroLoginBtn.classList.remove("hidden");
resourceList.replaceChildren();
}
});

// Settings are ready for the next upload feature.
console.info("StudyShelf initialized.", {
cloudinaryConfigured: Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
});
