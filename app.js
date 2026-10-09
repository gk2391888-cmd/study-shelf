import {
signInWithPopup,
signOut,
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { auth, googleProvider } from "./firebase-config.js";

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
toast.textContent = message;
toast.classList.add("show");
setTimeout(() => toast.classList.remove("show"), 3500);
}

async function loginWithGoogle() {
try {
await signInWithPopup(auth, googleProvider);
} catch (error) {
console.error("Google sign-in error:", error);
showToast(error.message || "Google login failed.");
}
}

loginBtn.addEventListener("click", loginWithGoogle);
heroLoginBtn.addEventListener("click", loginWithGoogle);

logoutBtn.addEventListener("click", async () => {
try {
await signOut(auth);
} catch (error) {
console.error(error);
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
  "Login successful! Payment and assignment access will be configured next.";

resourceList.replaceChildren();

const card = document.createElement("article");
card.className = "resource-item";

const title = document.createElement("h3");
title.textContent = "Your StudyShelf account is ready";

const description = document.createElement("p");
description.textContent =
  "Study resources will appear here after the secure access system is configured.";

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
