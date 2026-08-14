(function () {
  "use strict";

  const SAVE_KEY = "sudokuSeniorSave";
  const SETTINGS_KEY = "sudokuSeniorSettings";
  const HINTS_PER_GAME = 3;

  const DIFFICULTY_LABEL = { easy: "초급", medium: "중급", hard: "고급" };

  const screens = {
    home: document.getElementById("screen-home"),
    howto: document.getElementById("screen-howto"),
    game: document.getElementById("screen-game"),
  };

  const boardEl = document.getElementById("board");
  const timerEl = document.getElementById("timer");
  const difficultyLabelEl = document.getElementById("difficulty-label");
  const hintCountEl = document.getElementById("hint-count");
  const continueBtn = document.getElementById("btn-continue");
  const continueInfo = document.getElementById("continue-info");

  let state = null; // 현재 게임 상태
  let cellEls = [];
  let timerHandle = null;

  // ---------- 화면 전환 ----------

  function showScreen(name) {
    Object.values(screens).forEach((s) => (s.hidden = true));
    screens[name].hidden = false;
  }

  // ---------- 설정 (글씨 크기) ----------

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { largeText: false };
    } catch (e) {
      return { largeText: false };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applySettings(settings) {
    document.body.classList.toggle("large-text", !!settings.largeText);
  }

  const settings = loadSettings();
  applySettings(settings);

  document.getElementById("btn-text-size").addEventListener("click", () => {
    settings.largeText = !settings.largeText;
    applySettings(settings);
    saveSettings(settings);
  });

  // ---------- 게임 방법 ----------

  document.getElementById("btn-howto").addEventListener("click", () => showScreen("howto"));
  document.getElementById("btn-howto-close").addEventListener("click", () => showScreen("home"));

  // ---------- 저장/불러오기 ----------

  function persist() {
    if (!state) return;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        puzzle: state.puzzle,
        solution: state.solution,
        board: state.board,
        given: state.given,
        difficulty: state.difficulty,
        elapsed: getElapsedSeconds(),
        hintsLeft: state.hintsLeft,
        done: state.done,
      })
    );
  }

  function clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function refreshContinueButton() {
    const save = loadSave();
    if (save && !save.done) {
      continueBtn.hidden = false;
      const mins = Math.floor(save.elapsed / 60);
      const secs = save.elapsed % 60;
      continueInfo.textContent = `${DIFFICULTY_LABEL[save.difficulty]} · ${pad(mins)}:${pad(secs)}`;
    } else {
      continueBtn.hidden = true;
    }
  }

  // ---------- 보드 DOM 생성 ----------

  function buildBoardDOM() {
    boardEl.innerHTML = "";
    cellEls = [];
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.index = i;
      if (c === 2 || c === 5) cell.classList.add("border-right");
      if (r === 2 || r === 5) cell.classList.add("border-bottom");

      const valueSpan = document.createElement("span");
      valueSpan.className = "cell-value";
      cell.appendChild(valueSpan);

      cell.addEventListener("click", () => onCellClick(i));
      boardEl.appendChild(cell);
      cellEls.push(cell);
    }
  }

  // ---------- 새 게임 시작 ----------

  function startNewGame(difficulty) {
    const loadingEl = document.getElementById("overlay-loading");
    loadingEl.hidden = false;
    setTimeout(() => {
      const { puzzle, solution } = generatePuzzle(difficulty);
      state = {
        difficulty,
        puzzle: puzzle.slice(),
        solution: solution.slice(),
        board: puzzle.slice(),
        given: puzzle.map((v) => v !== 0),
        selected: null,
        hintsLeft: HINTS_PER_GAME,
        done: false,
        startTimestamp: Date.now(),
        elapsedBeforePause: 0,
      };
      buildBoardDOM();
      difficultyLabelEl.textContent = DIFFICULTY_LABEL[difficulty];
      hintCountEl.textContent = state.hintsLeft;
      startTimer();
      render();
      persist();
      showScreen("game");
      loadingEl.hidden = true;
    }, 30);
  }

  function resumeSavedGame() {
    const save = loadSave();
    if (!save) return;
    state = {
      difficulty: save.difficulty,
      puzzle: save.puzzle,
      solution: save.solution,
      board: save.board,
      given: save.given,
      selected: null,
      hintsLeft: save.hintsLeft,
      done: save.done,
      startTimestamp: Date.now(),
      elapsedBeforePause: save.elapsed || 0,
    };
    buildBoardDOM();
    difficultyLabelEl.textContent = DIFFICULTY_LABEL[state.difficulty];
    hintCountEl.textContent = state.hintsLeft;
    startTimer();
    render();
    showScreen("game");
  }

  // ---------- 타이머 ----------

  function getElapsedSeconds() {
    if (!state) return 0;
    return state.elapsedBeforePause + Math.floor((Date.now() - state.startTimestamp) / 1000);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function updateTimerDisplay() {
    const total = getElapsedSeconds();
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    timerEl.textContent = `${pad(mins)}:${pad(secs)}`;
  }

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerHandle = setInterval(updateTimerDisplay, 1000);
  }

  function stopTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function pauseGame() {
    state.elapsedBeforePause = getElapsedSeconds();
    stopTimer();
    persist();
    document.getElementById("overlay-pause").hidden = false;
  }

  function resumeGame() {
    state.startTimestamp = Date.now();
    startTimer();
    document.getElementById("overlay-pause").hidden = true;
  }

  // ---------- 렌더링 ----------

  function render() {
    const selectedVal = state.selected !== null ? state.board[state.selected] : 0;
    let selR = -1, selC = -1;
    if (state.selected !== null) {
      selR = Math.floor(state.selected / 9);
      selC = state.selected % 9;
    }

    for (let i = 0; i < 81; i++) {
      const cell = cellEls[i];
      const r = Math.floor(i / 9);
      const c = i % 9;
      const v = state.board[i];
      const valueSpan = cell.querySelector(".cell-value");

      cell.classList.toggle("given", state.given[i]);
      cell.classList.toggle("selected", i === state.selected);

      const isPeer =
        state.selected !== null &&
        (r === selR || c === selC || (Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3)));
      cell.classList.toggle("peer", isPeer && i !== state.selected);

      cell.classList.toggle("samevalue", selectedVal !== 0 && v === selectedVal && i !== state.selected);
      cell.classList.toggle("error", !state.given[i] && v !== 0 && v !== state.solution[i]);

      if (v !== 0) {
        valueSpan.textContent = v;
        valueSpan.style.display = "";
      } else {
        valueSpan.style.display = "none";
      }
    }
  }

  // ---------- 입력 처리 ----------

  function onCellClick(i) {
    if (state.done) return;
    state.selected = i;
    render();
  }

  function isUnitComplete(board, solution, indices) {
    // A unit only counts as complete once every cell in it matches the solution,
    // which also guarantees it holds 1-9 with no repeats.
    return indices.every((idx) => board[idx] === solution[idx]);
  }

  function getCompletedUnits(board, solution, i) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const units = [];

    const rowIdx = [];
    for (let cc = 0; cc < 9; cc++) rowIdx.push(r * 9 + cc);
    if (isUnitComplete(board, solution, rowIdx)) units.push(rowIdx);

    const colIdx = [];
    for (let rr = 0; rr < 9; rr++) colIdx.push(rr * 9 + c);
    if (isUnitComplete(board, solution, colIdx)) units.push(colIdx);

    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const boxIdx = [];
    for (let bi = 0; bi < 3; bi++) {
      for (let bj = 0; bj < 3; bj++) boxIdx.push((br + bi) * 9 + (bc + bj));
    }
    if (isUnitComplete(board, solution, boxIdx)) units.push(boxIdx);

    return units;
  }

  // 완성된 줄/박스는 되돌릴 수 없도록 기본값(고정 칸)으로 잠근다.
  function lockCompletedUnits(i) {
    const units = getCompletedUnits(state.board, state.solution, i);
    const cells = new Set();
    units.forEach((unit) => unit.forEach((idx) => cells.add(idx)));
    cells.forEach((idx) => {
      state.given[idx] = true;
    });
    return [...cells];
  }

  function flashCells(indices) {
    if (indices.length === 0) return;
    indices.forEach((idx) => cellEls[idx].classList.add("flash-complete"));
    setTimeout(() => {
      indices.forEach((idx) => cellEls[idx].classList.remove("flash-complete"));
    }, 700);
  }

  function inputNumber(num) {
    if (!state || state.done || state.selected === null) return;
    const i = state.selected;
    if (state.given[i]) return;

    state.board[i] = state.board[i] === num ? 0 : num;
    const completedCells = state.board[i] !== 0 ? lockCompletedUnits(i) : [];
    render();
    persist();
    flashCells(completedCells);
    checkWin();
  }

  function eraseSelected() {
    if (!state || state.done || state.selected === null) return;
    const i = state.selected;
    if (state.given[i]) return;
    if (state.board[i] === 0) return;
    state.board[i] = 0;
    render();
    persist();
  }

  function useHint() {
    if (!state || state.done || state.hintsLeft <= 0) return;
    let target = state.selected;
    if (target === null || state.board[target] !== 0) {
      const emptyCells = [];
      for (let i = 0; i < 81; i++) if (state.board[i] === 0) emptyCells.push(i);
      if (emptyCells.length === 0) return;
      target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      state.selected = target;
    }
    state.board[target] = state.solution[target];
    state.given[target] = true;
    state.hintsLeft--;
    hintCountEl.textContent = state.hintsLeft;
    const completedCells = lockCompletedUnits(target);
    render();
    persist();
    flashCells(completedCells);
    checkWin();
  }

  function checkWin() {
    if (isBoardComplete(state.board, state.solution)) {
      state.done = true;
      stopTimer();
      persist();
      document.getElementById("win-time").textContent = `완성 시간: ${timerEl.textContent}`;
      document.getElementById("overlay-win").hidden = false;
    }
  }

  // ---------- 이벤트 연결 ----------

  document.querySelectorAll(".btn-difficulty").forEach((btn) => {
    btn.addEventListener("click", () => startNewGame(btn.dataset.difficulty));
  });

  continueBtn.addEventListener("click", resumeSavedGame);

  document.querySelectorAll(".num-btn").forEach((btn) => {
    btn.addEventListener("click", () => inputNumber(parseInt(btn.dataset.num, 10)));
  });

  document.getElementById("btn-erase").addEventListener("click", eraseSelected);
  document.getElementById("btn-hint").addEventListener("click", useHint);

  document.getElementById("btn-back").addEventListener("click", () => {
    stopTimer();
    persist();
    refreshContinueButton();
    showScreen("home");
  });

  document.getElementById("btn-pause").addEventListener("click", pauseGame);
  document.getElementById("btn-resume").addEventListener("click", resumeGame);
  document.getElementById("btn-pause-home").addEventListener("click", () => {
    document.getElementById("overlay-pause").hidden = true;
    stopTimer();
    persist();
    refreshContinueButton();
    showScreen("home");
  });

  document.getElementById("btn-win-again").addEventListener("click", () => {
    document.getElementById("overlay-win").hidden = true;
    startNewGame(state.difficulty);
  });
  document.getElementById("btn-win-home").addEventListener("click", () => {
    document.getElementById("overlay-win").hidden = true;
    clearSave();
    refreshContinueButton();
    showScreen("home");
  });

  // ---------- 업데이트 확인 ----------
  // 사이드로드 앱은 스스로를 조용히 덮어쓸 수 없으므로(설치는 항상 사용자 확인 필요),
  // 새 버전이 있으면 외부 브라우저로 APK 다운로드 URL을 열어 다운로드->설치를 대신 시작해준다.

  const APP_VERSION_CODE = 2;
  const APP_VERSION_NAME = "1.1";
  const UPDATE_MANIFEST_URL = "https://green3077.github.io/sudoku-senior/version.json";
  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const UpdateBridge = IS_NATIVE ? window.Capacitor.registerPlugin("UpdateBridge") : null;

  const updateBtn = document.getElementById("btn-update");
  const updateStatusEl = document.getElementById("update-status");
  let pendingApkUrl = null;

  updateBtn.addEventListener("click", async () => {
    if (pendingApkUrl) {
      if (IS_NATIVE && UpdateBridge) {
        UpdateBridge.openExternal({ url: pendingApkUrl }).catch(() => {
          updateStatusEl.textContent = "업데이트 파일을 여는 데 실패했습니다.";
        });
      } else {
        window.open(pendingApkUrl, "_blank");
      }
      return;
    }
    updateStatusEl.textContent = "업데이트 확인 중...";
    try {
      const res = await fetch(UPDATE_MANIFEST_URL + "?t=" + Date.now());
      const info = await res.json();
      if (!info || typeof info.versionCode !== "number") {
        updateStatusEl.textContent = "업데이트 정보를 확인하지 못했습니다.";
        return;
      }
      if (info.versionCode <= APP_VERSION_CODE) {
        updateStatusEl.textContent = "이미 최신 버전입니다 (v" + APP_VERSION_NAME + ")";
        return;
      }
      pendingApkUrl = info.apkUrl;
      updateBtn.textContent = "새 버전(" + (info.versionName || info.versionCode) + ") 다운로드하기";
      updateStatusEl.textContent = "다시 눌러서 다운로드를 시작하세요.";
    } catch (e) {
      updateStatusEl.textContent = "업데이트 확인에 실패했습니다. 네트워크를 확인해주세요.";
    }
  });

  // ---------- 초기화 ----------

  refreshContinueButton();
  showScreen("home");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
