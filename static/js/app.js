import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4LLaxq7JkH-bZRDyV-0Vb2BoQRqLx4tY",
    authDomain: "wordle-e5e3d.firebaseapp.com",
    databaseURL: "https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "wordle-e5e3d",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const WORDS = [
    "MACKA", "KNIHA", "SKOLA", "HRADY", "KVETY",
    "MESTO", "PLAME", "STROM", "VLAKY", "OBLAK",
    "MOREA", "KARTA", "LAMPA", "CESTA", "PESIA",
    "RUKAV", "SLOVO", "DENIK", "NOZIK", "ZEBRA",
];

const ROWS = 6;
const COLS = 5;
const keyboardRows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Backspace", "Z", "X", "C", "V", "B", "N", "M", "Enter"],
];

const board = document.querySelector("#board");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const newGameButton = document.querySelector("#new-game");
const authForm = document.querySelector("#auth-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const displayNameInput = document.querySelector("#display-name");
const displayNameGroup = document.querySelector("#display-name-group");
const toggleAuthModeButton = document.querySelector("#toggle-auth-mode");
const primaryAuthButton = document.querySelector("#primary-auth-button");
const authTitle = document.querySelector(".auth-header h2");
const authSubtitle = document.querySelector(".auth-header p");
const togglePasswordButton = document.querySelector("#toggle-password");
const logoutButton = document.querySelector("#logout");
const userNav = document.querySelector("#user-nav");
const userName = document.querySelector("#user-name");
const leaderboard = document.querySelector("#leaderboard");
const navLeaderboard = document.querySelector("#nav-leaderboard");
const navHistory = document.querySelector("#nav-history");
const historyList = document.querySelector("#history-list");
const newGameModal = document.querySelector("#new-game-modal");
const modalYes = document.querySelector("#modal-yes");
const modalNo = document.querySelector("#modal-no");
const profileModal = document.querySelector("#profile-modal");
const openProfileButton = document.querySelector("#open-profile");
const profileModalClose = document.querySelector("#profile-modal-close");
const profileNameInput = document.querySelector("#profile-name-input");
const saveNameButton = document.querySelector("#save-name");
const deleteAccountButton = document.querySelector("#delete-account");
const logoutModal = document.querySelector("#logout-modal");
const modalLogoutYes = document.querySelector("#modal-logout-yes");
const modalLogoutNo = document.querySelector("#modal-logout-no");
const deleteAccountModal = document.querySelector("#delete-account-modal");
const modalDeleteYes = document.querySelector("#modal-delete-yes");
const modalDeleteNo = document.querySelector("#modal-delete-no");

const gameOverModal = document.querySelector("#game-over-modal");
const gameOverTitle = document.querySelector("#game-over-title");
const gameOverMessage = document.querySelector("#game-over-message");
const modalGameOverNew = document.querySelector("#modal-game-over-new");
const modalGameOverClose = document.querySelector("#modal-game-over-close");

let currentUser = null;
let targetWord = "";
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let startedAt = Date.now();
let messageTimeout = null;
let isLoginMode = true;

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function api(path, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (auth.currentUser) {
        try {
            const token = await auth.currentUser.getIdToken();
            options.headers["Authorization"] = `Bearer ${token}`;
        } catch (e) {}
    }
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(path, options);
    return res.json();
}

// ---------------------------------------------------------------------------
// Game helpers
// ---------------------------------------------------------------------------

function normalizeWord(value) {
    return value
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "");
}

function setMessage(text, duration = 1500) {
    message.textContent = text;
    message.classList.remove("fade-out");
    if (messageTimeout) clearTimeout(messageTimeout);
    if (text && duration > 0) {
        messageTimeout = setTimeout(() => {
            message.classList.add("fade-out");
            setTimeout(() => {
                if (message.classList.contains("fade-out")) {
                    message.textContent = "";
                    message.classList.remove("fade-out");
                }
            }, 300);
        }, duration);
    }
}

function createBoard() {
    board.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        const row = document.createElement("div");
        row.className = "row";
        for (let c = 0; c < COLS; c++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.dataset.row = r;
            tile.dataset.col = c;
            row.appendChild(tile);
        }
        board.appendChild(row);
    }
}

function createKeyboard() {
    keyboard.innerHTML = "";
    keyboardRows.forEach((keys) => {
        const row = document.createElement("div");
        row.className = "keyboard-row";
        keys.forEach((key) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.key = key;
            if (key === "Backspace") {
                button.innerHTML = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"></path></svg>';
            } else {
                button.textContent = key;
            }
            if (key === "Enter" || key === "Backspace") button.classList.add("wide-button");
            button.addEventListener("click", () => handleKey(key));
            row.appendChild(button);
        });
        keyboard.appendChild(row);
    });
}

function getTile(row, col) {
    return board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

function getCurrentGuess() {
    return Array.from({ length: COLS }, (_, col) => getTile(currentRow, col).textContent).join("");
}

function resetKeyboard() {
    keyboard.querySelectorAll("button").forEach((btn) => {
        btn.classList.remove("key-correct", "key-present", "key-absent");
        btn.disabled = false;
    });
}

function switchToGame() {
    document.body.classList.remove("view-leaderboard", "view-history");
    navLeaderboard && navLeaderboard.classList.remove("active");
    navHistory && navHistory.classList.remove("active");
}

function startNewGame() {
    targetWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    currentRow = 0;
    currentCol = 0;
    gameOver = false;
    startedAt = Date.now();
    createBoard();
    resetKeyboard();
    setMessage("");
    switchToGame();
}

function addLetter(letter) {
    if (currentCol >= COLS) return;
    const tile = getTile(currentRow, currentCol);
    tile.textContent = letter;
    tile.classList.add("filled");
    currentCol++;
}

function removeLetter() {
    if (currentCol <= 0) return;
    currentCol--;
    const tile = getTile(currentRow, currentCol);
    tile.textContent = "";
    tile.classList.remove("filled");
}

function setKeyState(letter, state) {
    const button = keyboard.querySelector(`[data-key="${letter}"]`);
    if (!button) return;
    if (button.classList.contains("key-correct")) return;
    if (button.classList.contains("key-present") && state === "key-absent") return;
    button.classList.remove("key-correct", "key-present", "key-absent");
    button.classList.add(state);
}

function scoreGuess(guess) {
    const states = Array(COLS).fill("absent");
    const remaining = targetWord.split("");
    for (let i = 0; i < COLS; i++) {
        if (guess[i] === targetWord[i]) { states[i] = "correct"; remaining[i] = null; }
    }
    for (let i = 0; i < COLS; i++) {
        if (states[i] === "correct") continue;
        const mi = remaining.indexOf(guess[i]);
        if (mi !== -1) { states[i] = "present"; remaining[mi] = null; }
    }
    return states;
}

async function submitScore(attempts, won) {
    if (!currentUser) {
        return;
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    const result = await api("/api/score", "POST", { attempts, elapsedSeconds, word: targetWord, won });

    if (won) {
        loadLeaderboard();
    }
}

async function submitGuess() {
    if (currentCol < COLS) { setMessage("Slovo musí mať 5 písmen."); return; }

    const guess = getCurrentGuess();
    const states = scoreGuess(guess);
    const keyStates = {};

    states.forEach((state, col) => {
        getTile(currentRow, col).classList.add(state);
        const letter = guess[col];
        if (state === "correct") keyStates[letter] = "key-correct";
        else if (state === "present" && keyStates[letter] !== "key-correct") keyStates[letter] = "key-present";
        else if (state === "absent" && keyStates[letter] !== "key-correct" && keyStates[letter] !== "key-present") keyStates[letter] = "key-absent";
    });

    Object.entries(keyStates).forEach(([letter, state]) => setKeyState(letter, state));

    if (guess === targetWord) {
        gameOver = true;
        showGameOverModal(true, currentRow + 1, targetWord);
        await submitScore(currentRow + 1, true);
        return;
    }

    if (currentRow === ROWS - 1) {
        gameOver = true;
        showGameOverModal(false, currentRow + 1, targetWord);
        await submitScore(currentRow + 1, false);
        return;
    }

    currentRow++;
    currentCol = 0;
}

function handleKey(key) {
    if (!currentUser) { setMessage("Najprv sa prihlás."); return; }
    if (gameOver) return;
    if (key === "Enter") { submitGuess(); return; }
    if (key === "Backspace") { removeLetter(); return; }
    if (/^[A-Z]$/.test(key)) addLetter(key);
}

function handlePhysicalKeyboard(event) {
    const el = event.target;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable) return;
    const key = event.key === "Backspace" || event.key === "Enter" ? event.key : normalizeWord(event.key);
    if (key === "Backspace" || key === "Enter" || /^[A-Z]$/.test(key)) {
        event.preventDefault();
        handleKey(key);
    }
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

let lbPage = 1;
let histPage = 1;
const ITEMS_PER_PAGE = 8;

function updatePagination(type, total, page, limit) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    
    document.getElementById(`${type}-pagination`).style.display = total > 0 ? "flex" : "none";
    document.getElementById(`${type}-page-info`).textContent = `${page} / ${totalPages}`;
    
    document.getElementById(`${type}-prev`).disabled = page <= 1;
    document.getElementById(`${type}-next`).disabled = page >= totalPages;
}

document.getElementById("lb-prev").addEventListener("click", () => { if (lbPage > 1) { lbPage--; loadLeaderboard(); } });
document.getElementById("lb-next").addEventListener("click", () => { lbPage++; loadLeaderboard(); });
document.getElementById("hist-prev").addEventListener("click", () => { if (histPage > 1) { histPage--; loadHistory(); } });
document.getElementById("hist-next").addEventListener("click", () => { histPage++; loadHistory(); });

function renderLeaderboard(scores, offset = 0) {
    leaderboard.innerHTML = "";
    if (!scores.length) {
        leaderboard.innerHTML = "<li class='lb-empty'>Zatiaľ žiadne skóre.</li>";
        return;
    }
    scores.forEach((entry, index) => {
        const globalIndex = offset + index;
        const item = document.createElement("li");
        item.className = `lb-item ${globalIndex < 3 ? `lb-top-${globalIndex + 1}` : ""}`;

        const rank = document.createElement("span");
        rank.className = "lb-rank";
        rank.textContent = `${globalIndex + 1}.`;

        const info = document.createElement("div");
        info.className = "lb-info";

        const name = document.createElement("strong");
        name.className = "lb-name";
        name.textContent = entry.name;

        const details = document.createElement("span");
        details.className = "lb-details";
        details.textContent = `${entry.attempts} pokusov · ${entry.elapsedSeconds}s · ${entry.word}`;

        info.append(name, details);

        const scoreEl = document.createElement("span");

        item.append(rank, info, scoreEl);
        leaderboard.appendChild(item);
    });
}

async function loadLeaderboard() {
    try {
        const data = await api(`/api/leaderboard?page=${lbPage}&limit=${ITEMS_PER_PAGE}`);
        renderLeaderboard(data.items || [], (lbPage - 1) * ITEMS_PER_PAGE);
        updatePagination("lb", data.total || 0, lbPage, ITEMS_PER_PAGE);
    } catch {
        leaderboard.innerHTML = "<li>Leaderboard sa nepodarilo načítať.</li>";
        document.getElementById("lb-pagination").style.display = "none";
    }
}


// ---------------------------------------------------------------------------
// História hier
// ---------------------------------------------------------------------------

function formatDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })
        + " " + d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
}

function renderHistory(entries) {
    historyList.innerHTML = "";
    if (!entries.length) {
        historyList.innerHTML = "<li class='lb-empty'>Zatiaľ žiadne hry.</li>";
        return;
    }
    entries.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "lb-item history-item";

        const result = document.createElement("span");
        result.className = `history-result ${entry.won ? "history-win" : "history-loss"}`;
        result.textContent = entry.won ? "✓" : "✗";

        const info = document.createElement("div");
        info.className = "lb-info";

        const word = document.createElement("strong");
        word.className = "lb-name";
        word.textContent = entry.word;

        const details = document.createElement("span");
        details.className = "lb-details";
        details.textContent = `${entry.attempts} pokusov · ${entry.elapsedSeconds}s · ${formatDate(entry.playedAt)}`;

        info.append(word, details);

        const badge = document.createElement("span");
        badge.className = `lb-score ${entry.won ? "history-badge-win" : "history-badge-loss"}`;
        badge.textContent = entry.won ? "výhra" : "prehra";

        item.append(result, info, badge);
        historyList.appendChild(item);
    });
}

async function loadHistory() {
    historyList.innerHTML = "<li class='lb-empty'>Načítavam...</li>";
    try {
        const data = await api(`/api/history?page=${histPage}&limit=${ITEMS_PER_PAGE}`);
        renderHistory(data.items || []);
        updatePagination("hist", data.total || 0, histPage, ITEMS_PER_PAGE);
    } catch {
        historyList.innerHTML = "<li>Históriu sa nepodarilo načítať.</li>";
        document.getElementById("hist-pagination").style.display = "none";
    }
}

// ---------------------------------------------------------------------------
// Auth events
// ---------------------------------------------------------------------------

togglePasswordButton.addEventListener("click", () => {
    const isText = passwordInput.getAttribute("type") === "text";
    passwordInput.setAttribute("type", isText ? "password" : "text");
    togglePasswordButton.classList.toggle("show-password", !isText);
});

toggleAuthModeButton.addEventListener("click", () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "Prihlásenie";
        authSubtitle.textContent = "Vitaj!";
        primaryAuthButton.textContent = "Prihlásiť sa";
        toggleAuthModeButton.textContent = "Nová registrácia";
        displayNameGroup.style.display = "none";
    } else {
        authTitle.textContent = "Registrácia";
        authSubtitle.textContent = "Vytvor si účet a ukladaj výsledky.";
        primaryAuthButton.textContent = "Vytvoriť účet";
        toggleAuthModeButton.textContent = "Mám už účet (Prihlásenie)";
        displayNameGroup.style.display = "block";
    }
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) { setMessage("Prosím vyplň email a heslo."); return; }

    if (isLoginMode) {
        try {
            const credentials = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await credentials.user.getIdToken();
            const result = await api("/api/login", "POST", { idToken });
            if (result.error) { setMessage(result.error); return; }
            emailInput.value = "";
            passwordInput.value = "";
        } catch (error) {
            if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
                setMessage("Nesprávny email alebo heslo.");
            } else {
                setMessage("Chyba pri prihlásení.");
            }
        }
    } else {
        const displayName = displayNameInput.value;
        try {
            const fallbackName = email.split("@")[0];
            const name = displayName.trim() || fallbackName;

            const creds = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(creds.user, { displayName: name });
            const idToken = await creds.user.getIdToken();
            await api("/api/login", "POST", { idToken, name: name });

            emailInput.value = "";
            passwordInput.value = "";
            displayNameInput.value = "";
            setMessage("Úspešne zaregistrovaný!");

            isLoginMode = true;
            authTitle.textContent = "Prihlásenie";
            authSubtitle.textContent = "Vitaj! Pre ukladanie skóre sa prihlás.";
            primaryAuthButton.textContent = "Prihlásiť sa";
            toggleAuthModeButton.textContent = "Nová registrácia";
            displayNameGroup.style.display = "none";
        } catch (error) {
            if (error.code === "auth/email-already-in-use") setMessage("Tento email sa už používa.");
            else if (error.code === "auth/weak-password") setMessage("Heslo je príliš slabé (min. 6 znakov).");
            else setMessage("Chyba pri registrácii: " + error.message);
        }
    }
});

// Profile modal
if (openProfileButton) {
    openProfileButton.addEventListener("click", () => {
        if (currentUser) profileNameInput.value = currentUser.displayName || currentUser.email.split("@")[0];
        profileModal.showModal();
    });
}
if (profileModalClose) profileModalClose.addEventListener("click", () => profileModal.close());
if (profileModal) profileModal.addEventListener("click", (e) => { if (e.target === profileModal) profileModal.close(); });

if (saveNameButton) {
    saveNameButton.addEventListener("click", async () => {
        const newName = profileNameInput.value.trim();
        if (!newName) { setMessage("Meno nemôže byť prázdne."); return; }
        if (!currentUser) return;
        try {
            const result = await api("/api/user/name", "POST", { name: newName });
            if (result.error) { setMessage("Nepodarilo sa uložiť meno."); return; }
            await updateProfile(currentUser, { displayName: newName });
            userName.textContent = newName;
            setMessage("Meno bolo uložené ✓");
            profileModal.close();
            loadLeaderboard();
        } catch {
            setMessage("Nepodarilo sa uložiť meno.");
        }
    });
}

logoutButton.addEventListener("click", () => { profileModal.close(); logoutModal.showModal(); });

if (modalLogoutYes && modalLogoutNo) {
    modalLogoutYes.addEventListener("click", async () => {
        logoutModal.close();
        await api("/api/logout", "POST");
        await signOut(auth);
    });
    modalLogoutNo.addEventListener("click", () => logoutModal.close());
}
if (logoutModal) logoutModal.addEventListener("click", (e) => { if (e.target === logoutModal) logoutModal.close(); });

if (deleteAccountButton) {
    deleteAccountButton.addEventListener("click", () => { profileModal.close(); deleteAccountModal.showModal(); });
}
if (modalDeleteYes && modalDeleteNo) {
    modalDeleteYes.addEventListener("click", async () => {
        deleteAccountModal.close();
        if (!currentUser) return;
        try {
            const result = await api("/api/user/delete", "POST");
            if (result.error) { setMessage("Nepodarilo sa vymazať účet."); return; }
            await signOut(auth);
            setMessage("Účet bol vymazaný.");
        } catch (error) {
            if (error.code === "auth/requires-recent-login") { setMessage("Pre vymazanie účtu sa znovu prihlás."); await signOut(auth); }
            else setMessage("Nepodarilo sa vymazať účet.");
        }
    });
    modalDeleteNo.addEventListener("click", () => deleteAccountModal.close());
}
if (deleteAccountModal) deleteAccountModal.addEventListener("click", (e) => { if (e.target === deleteAccountModal) deleteAccountModal.close(); });

newGameButton.addEventListener("click", () => {
    if (gameOver || (currentRow === 0 && currentCol === 0)) startNewGame();
    else newGameModal.showModal();
});
if (modalYes && modalNo) {
    modalYes.addEventListener("click", () => { newGameModal.close(); startNewGame(); });
    modalNo.addEventListener("click", () => newGameModal.close());
}
if (newGameModal) newGameModal.addEventListener("click", (e) => { if (e.target === newGameModal) newGameModal.close(); });

if (modalGameOverNew) modalGameOverNew.addEventListener("click", () => { gameOverModal.close(); startNewGame(); });
if (modalGameOverClose) modalGameOverClose.addEventListener("click", () => gameOverModal.close());
if (gameOverModal) gameOverModal.addEventListener("click", (e) => { if (e.target === gameOverModal) gameOverModal.close(); });

function showGameOverModal(won, attempts, word) {
    if (!gameOverModal) return;
    gameOverTitle.textContent = won ? "Výhra!" : "Prehra";
    gameOverMessage.textContent = won 
        ? `Uhádol si slovo ${word} na ${attempts}. pokus.` 
        : `Správne slovo bolo ${word}. Možno nabudúce!`;
    gameOverModal.showModal();
}

document.addEventListener("keydown", handlePhysicalKeyboard);

// Nav – leaderboard
if (navLeaderboard) {
    navLeaderboard.addEventListener("click", () => {
        const active = document.body.classList.toggle("view-leaderboard");
        navLeaderboard.classList.toggle("active", active);
        document.body.classList.remove("view-history");
        navHistory && navHistory.classList.remove("active");
        if (active) loadLeaderboard();
    });
}

// Nav – história
if (navHistory) {
    navHistory.addEventListener("click", () => {
        const active = document.body.classList.toggle("view-history");
        navHistory.classList.toggle("active", active);
        document.body.classList.remove("view-leaderboard");
        navLeaderboard && navLeaderboard.classList.remove("active");
        if (active) loadHistory();
    });
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const isLoggedIn = Boolean(user);
    document.body.classList.toggle("auth-required", !isLoggedIn);
    authForm.classList.toggle("hidden", isLoggedIn);
    userNav.classList.toggle("hidden", !isLoggedIn);
    userName.textContent = isLoggedIn ? user.displayName || user.email : "";
    setMessage("");
    loadLeaderboard();
});

createBoard();
createKeyboard();
startNewGame();
loadLeaderboard();
