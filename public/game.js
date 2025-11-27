// CONFIGURAÇÃO DOS EMOJIS (Sem imagens externas)
const TEAM_ASSETS = {
    'bra': { emoji: '🇧🇷', color: '#009c3b' },
    'fra': { emoji: '🇫🇷', color: '#0055a4' },
    'eng': { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#cf081f' },
    'ger': { emoji: '🇩🇪', color: '#dd0000' },
    'spa': { emoji: '🇪🇸', color: '#aa151b' },
    'por': { emoji: '🇵🇹', color: '#ff0000' },
    'ned': { emoji: '🇳🇱', color: '#f36c21' }, // Holanda
    'cro': { emoji: '🇭🇷', color: '#ff0000' }  // Croácia
};

let boardConfig = [];
let balance = 0;
let isSpinning = false;
let currentLightIndex = 0;

const boardGrid = document.getElementById('boardGrid');
const creditDisplay = document.getElementById('creditDisplay');
const winDisplay = document.getElementById('winDisplay');
const betControls = document.getElementById('betControls');
const spinBtn = document.getElementById('spinBtn');
const resultMessage = document.getElementById('resultMessage');

async function init() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        boardConfig = data.board;
        balance = data.balance;
        updateBalance();
        renderBoard();
        renderBetControls();
    } catch(e) { console.error(e); }
}

function updateBalance() {
    creditDisplay.textContent = `R$ ${balance.toFixed(2)}`;
}

function renderBoard() {
    // Grid 7x7 mapeado
    const coords = [
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7], // Topo
        [2,7], [3,7], [4,7], [5,7], [6,7],               // Direita
        [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1], // Baixo
        [6,1], [5,1], [4,1], [3,1], [2,1]                // Esquerda
    ];

    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        
        const asset = TEAM_ASSETS[slot.id];
        div.innerHTML = `
            <div class="slot-emoji">${asset.emoji}</div>
            <div class="slot-mult">x${slot.mult}</div>
        `;

        if (coords[index]) {
            div.style.gridRow = coords[index][0];
            div.style.gridColumn = coords[index][1];
        }
        boardGrid.appendChild(div);
    });
}

function renderBetControls() {
    const uniqueTeams = {};
    boardConfig.forEach(s => { if(!uniqueTeams[s.id]) uniqueTeams[s.id] = s; });

    for (const id in uniqueTeams) {
        const team = uniqueTeams[id];
        const asset = TEAM_ASSETS[id];
        const div = document.createElement('div');
        div.className = 'bet-chip';
        div.innerHTML = `
            <div style="font-size: 1.5rem;">${asset.emoji}</div>
            <small style="color: ${asset.color}">x${team.mult}</small>
            <input type="number" data-team="${id}" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;

    const inputs = document.querySelectorAll('.bet-chip input');
    const bets = {};
    let totalBet = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0) {
            bets[inp.dataset.team] = val;
            totalBet += val;
        }
    });

    if (totalBet === 0) return alert("Aposte em pelo menos um time!");
    if (totalBet > balance) return alert("Saldo insuficiente.");

    isSpinning = true;
    spinBtn.disabled = true;
    resultMessage.classList.add('hidden');
    winDisplay.textContent = "R$ 0.00";

    try {
        const res = await fetch('/api/spin', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bets })
        });
        const data = await res.json();
        
        balance = data.newBalance;
        updateBalance();

        await runAnimation(data.resultIndex, data.winAmount, data.winnerTeam);

    } catch (e) { console.error(e); isSpinning = false; spinBtn.disabled = false; }
});

function runAnimation(targetIndex, winAmount, winnerName) {
    return new Promise(resolve => {
        let speed = 50;
        let position = currentLightIndex;
        let rounds = 0;
        const totalRounds = 3;

        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            const prev = document.getElementById(`slot-${position}`);
            if(prev) prev.classList.remove('active');

            position++;
            if (position >= boardConfig.length) position = 0;
            if (position === 0) rounds++;

            const curr = document.getElementById(`slot-${position}`);
            if(curr) curr.classList.add('active');

            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && position !== targetIndex) {
                speed += 20;
                setTimeout(step, speed);
            } else if (position === targetIndex) {
                resolve();
                endGame(winAmount, winnerName, position);
            } else {
                setTimeout(step, speed);
            }
        };
        step();
    });
}

function endGame(winAmount, winnerName, finalIndex) {
    isSpinning = false;
    spinBtn.disabled = false;
    currentLightIndex = finalIndex;
    updateBalance();

    if (winAmount > 0) {
        winDisplay.textContent = `R$ ${winAmount.toFixed(2)}`;
        resultMessage.innerHTML = `${winnerName}<br>WIN!`;
        resultMessage.classList.remove('hidden');
        
        const slot = document.getElementById(`slot-${finalIndex}`);
        slot.classList.add('active');
    }
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await fetch('/api/reset', {method:'POST'});
    const data = await res.json();
    balance = data.balance;
    updateBalance();
    winDisplay.textContent = "R$ 0.00";
    resultMessage.classList.add('hidden');
    document.querySelectorAll('input').forEach(i => i.value = '');
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
});

init();
