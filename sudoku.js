// 스도쿠 생성 및 검증 로직 (UI와 분리된 순수 로직)

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function idx(r, c) {
  return r * 9 + c;
}

function isValidPlacement(board, r, c, val) {
  for (let i = 0; i < 9; i++) {
    if (board[idx(r, i)] === val) return false;
    if (board[idx(i, c)] === val) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[idx(br + i, bc + j)] === val) return false;
    }
  }
  return true;
}

function fillBoard(board) {
  for (let pos = 0; pos < 81; pos++) {
    if (board[pos] !== 0) continue;
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const val of candidates) {
      if (isValidPlacement(board, r, c, val)) {
        board[pos] = val;
        if (fillBoard(board)) return true;
        board[pos] = 0;
      }
    }
    return false;
  }
  return true;
}

function countSolutions(board, limit) {
  let count = 0;

  function solve() {
    if (count >= limit) return;
    let pos = -1;
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0) {
        pos = i;
        break;
      }
    }
    if (pos === -1) {
      count++;
      return;
    }
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    for (let val = 1; val <= 9; val++) {
      if (count >= limit) return;
      if (isValidPlacement(board, r, c, val)) {
        board[pos] = val;
        solve();
        board[pos] = 0;
      }
    }
  }

  solve();
  return count;
}

// 난이도별 남길 힌트(단서) 개수
const DIFFICULTY_CLUES = {
  easy: 42,
  medium: 32,
  hard: 25,
};

function generatePuzzle(difficulty) {
  const solution = new Array(81).fill(0);
  fillBoard(solution);

  const puzzle = solution.slice();
  const targetClues = DIFFICULTY_CLUES[difficulty] || DIFFICULTY_CLUES.medium;
  const positions = shuffle([...Array(81).keys()]);

  let clues = 81;
  const maxAttempts = 81;
  let attempts = 0;

  for (const pos of positions) {
    if (clues <= targetClues || attempts >= maxAttempts) break;
    attempts++;
    const backup = puzzle[pos];
    puzzle[pos] = 0;

    const testBoard = puzzle.slice();
    const solCount = countSolutions(testBoard, 2);

    if (solCount === 1) {
      clues--;
    } else {
      puzzle[pos] = backup;
    }
  }

  return { puzzle, solution };
}

function isBoardComplete(board, solution) {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) return false;
    if (board[i] !== solution[i]) return false;
  }
  return true;
}
