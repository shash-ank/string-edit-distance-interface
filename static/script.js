// Global state
let tooltip = null;
let animationPaused = false;
let animationInProgress = false;
let pendingTimeout = null; 
let currentPhase = 'idle'; 
let cellQueue = [];  
let cellIndex = 0;   
let baseIndex = 0;   

const INNER_FILL_DELAY = 1300;
const BASE_FILL_DELAY = 200;
const TRACEBACK_DELAY = 500;

document.addEventListener('DOMContentLoaded', () => {
    tooltip = document.getElementById('tooltip');
    buildTable();

    const startBtn = document.getElementById('startBtn');
    const pauseResumeBtn = document.getElementById('pauseResumeBtn');
    const completeBtn = document.getElementById('completeBtn');

    // Initial state: start enabled, pause & complete disabled
    startBtn.disabled = false;
    pauseResumeBtn.disabled = true;
    completeBtn.disabled = true;

    startBtn.addEventListener('click', () => {
        if (startBtn.textContent === 'Start') {
            // First time click: change to "Restart"
            startBtn.textContent = 'Restart';
            animationInProgress = true;
            // Start/Restart stays enabled so user can restart mid-animation
            // Now that we have started, enable pause & complete
            pauseResumeBtn.disabled = false;
            completeBtn.disabled = false;
            showFlashMessage("Initializing the table...");
            setTimeout(() => {
                currentPhase = 'base';
                animateBaseCases();
            }, 1000);
        } else {
            // Restart clicked
            resetAnimation();
            // After reset, do the same steps as initial start
            startBtn.textContent = 'Restart';
            animationInProgress = true;
            pauseResumeBtn.disabled = false;
            completeBtn.disabled = false;
            showFlashMessage("Re-initializing the table...");
            setTimeout(() => {
                currentPhase = 'base';
                animateBaseCases();
            }, 1000);
        }
    });

    pauseResumeBtn.addEventListener('click', () => {
        if (animationInProgress) {
            if (animationPaused) {
                // Resume
                animationPaused = false;
                pauseResumeBtn.textContent = 'Pause';
                showFlashMessage("Resumed");
                resumeAnimation();
            } else {
                // Pause
                animationPaused = true;
                pauseResumeBtn.textContent = 'Resume';
                showFlashMessage("Animation Paused");
                clearPendingTimeout();
            }
        }
    });

    completeBtn.addEventListener('click', () => {
        if (animationInProgress) {
            // Complete
            animationPaused = false;
            clearPendingTimeout();
            fillAllCells();
            highlightPathAfterFilling();
            animationInProgress = false;
            // Animation ended, disable pause & complete
            pauseResumeBtn.disabled = true;
            completeBtn.disabled = true;
            // Start/Restart stays enabled
            showFlashMessage("Animation complete. The highlighted array cells correspond to the final answer.");

        }
    });
});

function buildTable() {
    const table = document.getElementById('dpTable');
    table.innerHTML = '';

    let headerRow = document.createElement('tr');
    let emptyCorner = document.createElement('th');
    headerRow.appendChild(emptyCorner);

    let emptyForS = document.createElement('th');
    emptyForS.textContent = '';
    headerRow.appendChild(emptyForS);

    for (let j = 0; j < tLen; j++) {
        let th = document.createElement('th');
        th.textContent = tStr[j];
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    for (let i = 0; i <= sLen; i++) {
        let row = document.createElement('tr');
        let sHeader = document.createElement('th');
        sHeader.textContent = (i == 0) ? '' : sStr[i-1];
        row.appendChild(sHeader);

        for (let j = 0; j <= tLen; j++) {
            let td = document.createElement('td');
            td.textContent = '';
            td.setAttribute('data-i', i);
            td.setAttribute('data-j', j);
            row.appendChild(td);
        }
        table.appendChild(row);
    }
}

function resetAnimation() {
    clearPendingTimeout();
    baseIndex = 0;
    cellIndex = 0;
    currentPhase = 'idle';
    animationPaused = false;
    animationInProgress = false;
    // On reset, animation is not running, so pause & complete disabled
    document.getElementById('pauseResumeBtn').disabled = true;
    document.getElementById('completeBtn').disabled = true;
    // Start (Restart) is enabled so user can start again
    document.getElementById('startBtn').disabled = false; 
    buildTable();
}

function animateBaseCases() {
    let baseCells = [];
    for (let j = 0; j <= tLen; j++) {
        baseCells.push([0, j]);
    }
    for (let i = 1; i <= sLen; i++) {
        baseCells.push([i, 0]);
    }

    function fillBaseCell() {
        if (animationPaused) return;
        if (baseIndex >= baseCells.length) {
            currentPhase = 'inner';
            prepareInnerCells();
            return;
        }
        let [bi, bj] = baseCells[baseIndex];
        fillCell(bi, bj, dpData[bi][bj]);
        baseIndex++;
        pendingTimeout = setTimeout(fillBaseCell, BASE_FILL_DELAY);
    }
    fillBaseCell();
}

function prepareInnerCells() {
    cellQueue = [];
    for (let i = 1; i <= sLen; i++) {
        for (let j = 1; j <= tLen; j++) {
            cellQueue.push([i,j]);
        }
    }
    cellIndex = 0;
    fillNextInnerCell();
}

function fillNextInnerCell() {
    if (animationPaused) return;
    if (cellIndex >= cellQueue.length) {
        currentPhase = 'traceback';
        highlightPathAfterFilling();
        animationInProgress = false;
        // Animation finished, disable pause & complete
        document.getElementById('pauseResumeBtn').disabled = true;
        document.getElementById('completeBtn').disabled = true;
        // Keep Start/Restart enabled
        return;
    }

    let [ci, cj] = cellQueue[cellIndex];
    animateCellCalculation(ci, cj, () => {
        cellIndex++;
        pendingTimeout = setTimeout(fillNextInnerCell, 500);
    });
}

function animateCellCalculation(i, j, callback) {
    let cell = getCell(i, j);
    let diagCell = getCell(i-1, j-1);
    let leftCell = getCell(i, j-1);
    let upCell = getCell(i-1, j);

    cell.classList.add('active-cell');
    diagCell.classList.add('contributing-cell');
    leftCell.classList.add('contributing-cell');
    upCell.classList.add('contributing-cell');

    let matchCost = dpData[i-1][j-1] + (sStr[i-1] === tStr[j-1] ? 0 : 1);
    let insertCost = dpData[i][j-1] + 1;
    let deleteCost = dpData[i-1][j] + 1;

    let explanation = `Calculating dp[${i},${j}]:<br>
        Match/Subst: ${matchCost}<br>
        Insert: ${insertCost}<br>
        Delete: ${deleteCost}<br>`;

    showTooltip(cell, explanation);

    pendingTimeout = setTimeout(() => {
        if (animationPaused) return;
        let minCost = Math.min(matchCost, insertCost, deleteCost);
        let operationName;
        if (minCost === matchCost) {
            operationName = (sStr[i-1] === tStr[j-1]) ? "Match" : "Substitute";
        } else if (minCost === insertCost) {
            operationName = "Insert";
        } else {
            operationName = "Delete";
        }

        let finalExplanation = `Optimal Operation: <strong>${operationName}</strong><br>
                                Value: ${minCost}`;
        showTooltip(cell, finalExplanation);

        pendingTimeout = setTimeout(() => {
            if (animationPaused) return;
            fillCell(i, j, minCost);

            cell.classList.remove('active-cell');
            diagCell.classList.remove('contributing-cell');
            leftCell.classList.remove('contributing-cell');
            upCell.classList.remove('contributing-cell');

            hideTooltip();
            callback();
        }, 800);
    }, INNER_FILL_DELAY);
}

function highlightPathAfterFilling() {
    let i = 0;
    function stepTraceback() {
        if (animationPaused) return;
        if (i >= pathCells.length) return;
        let [pi, pj] = pathCells[i];
        let c = getCell(pi, pj);
        c.classList.add('highlight');
        i++;
        pendingTimeout = setTimeout(stepTraceback, TRACEBACK_DELAY);
    }
    stepTraceback();
}

function fillAllCells() {
    for (let i = 0; i <= sLen; i++) {
        for (let j = 0; j <= tLen; j++) {
            fillCell(i, j, dpData[i][j]);
        }
    }
}

function getCell(i, j) {
    const table = document.getElementById('dpTable');
    return table.rows[i+1].cells[j+1];
}

function fillCell(i, j, value) {
    let cell = getCell(i, j);
    cell.textContent = value;
}

function showTooltip(cell, text) {
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';

    let rect = cell.getBoundingClientRect();
    let top = window.scrollY + rect.bottom + 10;
    let left = window.scrollX + rect.left + (rect.width / 2) - 20;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

function clearPendingTimeout() {
    if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
    }
}

function resumeAnimation() {
    if (currentPhase === 'base') {
        animateBaseCases();
    } else if (currentPhase === 'inner') {
        if (cellIndex < cellQueue.length) {
            pendingTimeout = setTimeout(fillNextInnerCell, 500);
        }
    } else if (currentPhase === 'traceback') {
        pendingTimeout = setTimeout(highlightPathAfterFilling, 500);
    }
}

function showFlashMessage(message) {
    const flashMessage = document.getElementById('flashMessage');
    flashMessage.textContent = message;
    flashMessage.style.display = 'block';
    setTimeout(() => {
        flashMessage.style.display = 'none';
    }, 3000);
}
