import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
    get,
    getDatabase,
    limitToFirst,
    onValue,
    orderByChild,
    query,
    ref,
    set,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4LLaxq7JkH-bZRDyV-0Vb2BoQRqLx4tY",
    authDomain: "wordle-e5e3d.firebaseapp.com",
    databaseURL: "https://wordle-e5e3d-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "wordle-e5e3d",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const WORDS = [
    "MACKA",
    "KNIHA",
    "SKOLA",
    "HRADY",
    "KVETY",
    "MESTO",
    "PLAME",
    "STROM",
    "VLAKY",
    "OBLAK",
    "MOREA",
    "KARTA",
    "LAMPA",
    "CESTA",
    "PESIA",
    "RUKAV",
    "SLOVO",
    "DENIK",
    "NOZIK",
    "ZEBRA",
];

const ROWS = 6;
const COLS = 5;
const keyboardRows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
];

const board = document.querySelector("#board");
const keyboard = document.querySelector("#keyboard");
const message = document.querySelector("#message");
const newGameButton = document.querySelector("#new-game");
const authForm = document.querySelector("#auth-form");
const registerButton = document.querySelector("#register");
const logoutButton = document.querySelector("#logout");
const userNav = document.querySelector("#user-nav");
const userName = document.querySelector("#user-name");
const leaderboard = document.querySelector("#leaderboard");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const displayNameInput = document.querySelector("#display-name");
const navLeaderboard = document.querySelector("#nav-leaderboard");

let currentUser = null;
let targetWord = "";
let currentRow = 0;
let currentCol = 0;
let gameOver = false;
let startedAt = Date.now();
let messageTimeout = null;

function normalizeWord(value) {
    return value
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z]/g, "");
}

function setMessage(text, duration = 3000) {
    message.textContent = text;
    if (messageTimeout) clearTimeout(messageTimeout);
    if (text && duration > 0) {
        messageTimeout = setTimeout(() => {
            message.textContent = "";
        }, duration);
    }
}

function createBoard() {
    board.innerHTML = "";

    for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
        const row = document.createElement("div");
        row.className = "row";

        for (let colIndex = 0; colIndex < COLS; colIndex += 1) {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.dataset.row = rowIndex;
            tile.dataset.col = colIndex;
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
            button.textContent = key === "Backspace" ? "⌫" : key;

            if (key === "Enter" || key === "Backspace") {
                button.classList.add("wide-button");
            }

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
    keyboard.querySelectorAll("button").forEach((button) => {
        button.classList.remove("key-correct", "key-present", "key-absent");
    });
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
    
    // Switch back to game view if we were on the leaderboard
    document.body.classList.remove("view-leaderboard");
    if (navLeaderboard) {
        navLeaderboard.classList.remove("active");
    }
}

function addLetter(letter) {
    if (currentCol >= COLS) {
        return;
    }

    const tile = getTile(currentRow, currentCol);
    tile.textContent = letter;
    tile.classList.add("filled");
    currentCol += 1;
}

function removeLetter() {
    if (currentCol <= 0) {
        return;
    }

    currentCol -= 1;
    const tile = getTile(currentRow, currentCol);
    tile.textContent = "";
    tile.classList.remove("filled");
}

function setKeyState(letter, state) {
    const button = keyboard.querySelector(`[data-key="${letter}"]`);
    const rank = { "": 0, "key-absent": 1, "key-present": 2, "key-correct": 3 };
    const currentState = ["key-correct", "key-present", "key-absent"].find((className) => button?.classList.contains(className)) || "";

    if (button && rank[state] > rank[currentState]) {
        button.classList.remove("key-correct", "key-present", "key-absent");
        button.classList.add(state);
    }
}

function scoreGuess(guess) {
    const states = Array(COLS).fill("absent");
    const remaining = targetWord.split("");

    for (let index = 0; index < COLS; index += 1) {
        if (guess[index] === targetWord[index]) {
            states[index] = "correct";
            remaining[index] = null;
        }
    }

    for (let index = 0; index < COLS; index += 1) {
        if (states[index] === "correct") {
            continue;
        }

        const matchIndex = remaining.indexOf(guess[index]);
        if (matchIndex !== -1) {
            states[index] = "present";
            remaining[matchIndex] = null;
        }
    }

    return states;
}

async function submitScore(attempts) {
    if (!currentUser) {
        setMessage(`Vyhral si na ${attempts}. Prihlás sa, aby sa skóre uložilo.`);
        return;
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    const score = attempts * 1000 + elapsedSeconds;
    const scoreRef = ref(database, `scores/${currentUser.uid}`);
    const snapshot = await get(scoreRef);
    const oldScore = snapshot.val();

    if (!oldScore || score < oldScore.score) {
        await set(scoreRef, {
            name: currentUser.displayName || currentUser.email.split("@")[0],
            attempts,
            elapsedSeconds,
            score,
            word: targetWord,
            updatedAt: Date.now(),
        });
        setMessage(`Výhra na ${attempts}. Nový rekord uložený 🔥`, 0);
        return;
    }

    setMessage(`Výhra na ${attempts}. Rekord ostáva ${oldScore.attempts} pokusov / ${oldScore.elapsedSeconds}s.`, 0);
}

async function submitGuess() {
    if (currentCol < COLS) {
        setMessage("Slovo musí mať 5 písmen.");
        return;
    }

    const guess = getCurrentGuess();
    const states = scoreGuess(guess);

    states.forEach((state, col) => {
        const tile = getTile(currentRow, col);
        tile.classList.add(state);
        setKeyState(guess[col], `key-${state}`);
    });

    if (guess === targetWord) {
        gameOver = true;
        await submitScore(currentRow + 1);
        return;
    }

    if (currentRow === ROWS - 1) {
        gameOver = true;
        setMessage(`Koniec hry. Správne slovo bolo ${targetWord}.`, 0);
        return;
    }

    currentRow += 1;
    currentCol = 0;
    setMessage("Skús ďalšie slovo.");
}

function handleKey(key) {
    if (!currentUser) {
        setMessage("Najprv sa prihlás.");
        return;
    }

    if (gameOver) {
        return;
    }

    if (key === "Enter") {
        submitGuess();
        return;
    }

    if (key === "Backspace") {
        removeLetter();
        return;
    }

    if (/^[A-Z]$/.test(key)) {
        addLetter(key);
    }
}

function handlePhysicalKeyboard(event) {
    const activeElement = event.target;
    const isFormField = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(activeElement.tagName) || activeElement.isContentEditable;

    if (isFormField) {
        return;
    }

    const key = event.key === "Backspace" || event.key === "Enter"
        ? event.key
        : normalizeWord(event.key);

    if (key === "Backspace" || key === "Enter" || /^[A-Z]$/.test(key)) {
        event.preventDefault();
        handleKey(key);
    }
}

async function login() {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    authForm.reset();
}

async function register() {
    const credentials = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    const fallbackName = emailInput.value.split("@")[0];
    await updateProfile(credentials.user, {
        displayName: displayNameInput.value.trim() || fallbackName,
    });
    authForm.reset();
}

async function saveUserProfile(user) {
    const publicProfile = {
        name: user.displayName || user.email.split("@")[0],
        lastLoginAt: Date.now(),
    };

    await set(ref(database, `players/${user.uid}`), publicProfile);
    await set(ref(database, `users/${user.uid}`), {
        ...publicProfile,
        email: user.email,
    });
}

function renderLeaderboard(scores) {
    leaderboard.innerHTML = "";

    if (!scores.length) {
        leaderboard.innerHTML = "<li>Zatiaľ žiadne skóre.</li>";
        return;
    }

    scores.forEach((entry) => {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        const details = document.createElement("span");

        name.textContent = entry.name;
        details.textContent = `${entry.attempts} pokusov · ${entry.elapsedSeconds}s · slovo ${entry.word}`;
        item.append(name, details);
        leaderboard.appendChild(item);
    });
}

function watchLeaderboard() {
    const scoresQuery = query(ref(database, "scores"), orderByChild("score"), limitToFirst(10));

    onValue(scoresQuery, (snapshot) => {
        const scores = [];
        snapshot.forEach((child) => scores.push(child.val()));
        renderLeaderboard(scores);
    }, () => {
        leaderboard.innerHTML = "<li>Leaderboard sa nepodarilo načítať.</li>";
    });
}

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
        await login();
    } catch (error) {
        setMessage(`Prihlásenie zlyhalo: ${error.message}`);
    }
});

registerButton.addEventListener("click", async () => {
    try {
        await register();
    } catch (error) {
        setMessage(`Registrácia zlyhala: ${error.message}`);
    }
});

logoutButton.addEventListener("click", async () => {
    await signOut(auth);
});

newGameButton.addEventListener("click", startNewGame);
document.addEventListener("keydown", handlePhysicalKeyboard);

if (navLeaderboard) {
    navLeaderboard.addEventListener("click", () => {
        const isLeaderboardView = document.body.classList.toggle("view-leaderboard");
        navLeaderboard.classList.toggle("active", isLeaderboardView);
    });
}

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const isLoggedIn = Boolean(user);

    document.body.classList.toggle("auth-required", !isLoggedIn);
    authForm.classList.toggle("hidden", isLoggedIn);
    userNav.classList.toggle("hidden", !isLoggedIn);
    userName.textContent = isLoggedIn ? user.displayName || user.email : "";

    if (isLoggedIn) {
        setMessage("");
        saveUserProfile(user).catch((error) => {
            setMessage(`Si prihlásený, ale Firebase zápis zlyhal: ${error.message}`);
        });
    } else {
        setMessage("");
    }
});

createBoard();
createKeyboard();
startNewGame();
watchLeaderboard();
