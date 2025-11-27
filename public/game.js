// MAPA DE ASSETS (EMOJIS)
const ASSETS = {
    'bra': { emoji: '🇧🇷', name: 'Brasil' },
    'fra': { emoji: '🇫🇷', name: 'França' },
    'eng': { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Inglaterra' },
    'ger': { emoji: '🇩🇪', name: 'Alemanha' },
    'spa': { emoji: '🇪🇸', name: 'Espanha' },
    'por': { emoji: '🇵🇹', name: 'Portugal' },
    'ned': { emoji: '🇳🇱', name: 'Holanda' },
    'cro': { emoji: '🇭🇷', name: 'Croácia' }
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
        renderControls();
    } catch(e) { console.error("Erro init:", e); }
}

function updateBalance() {
    creditDisplay.textContent = `R$ ${balance.toFixed(2)}`;
}

function renderBoard() {
    const coords = [
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
        [2,7], [3,7], [4,7], [5,7], [6,7],
        [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1],
        [6,1], [5,1], [4,1], [3,1], [2,1]
    ];

    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        
        const asset = ASSETS[slot.id];
        div.innerHTML = `
            <div class="emoji-icon">${asset.emoji}</div>
            <div class="mult-tag">x${slot.mult}</div>
        `;

        if (coords[index]) {
            div.style.gridRow = coords[index][0];
            div.style.gridColumn = coords[index][1];
        }
        boardGrid.appendChild(div);
    });
}

function renderControls() {
    const unique = {};
    boardConfig.forEach(s => { if(!unique[s.id]) unique[s.id] = s; });

    for (const id in unique) {
        const team = unique[id];
        const asset = ASSETS[id];
        
        const div = document.createElement('div');
        div.className = 'bet-chip';
        // Adicionei classe para emoji do chip ser ligeiramente menor
        div.innerHTML = `
            <div class="emoji-icon-chip">${asset.emoji}</div>
            <span style="font-size: 0.6rem; color: #71717a; margin-top: 2px;">x${team.mult}</span>
            <input type="number" data-id="${id}" placeholder="0" />
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
            bets[inp.dataset.id] = val;
            totalBet += val;
        }
    });

    if (totalBet === 0) return alert("Escolha um time para apostar!");
    if (totalBet > balance) return alert("Saldo insuficiente!");

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

        await runAnimation(data.resultIndex, data.winAmount, data.winnerId);

    } catch(e) { console.error(e); isSpinning = false; spinBtn.disabled = false; }
});

function runAnimation(targetIndex, winAmount, winnerId) {
    return new Promise(resolve => {
        let speed = 50;
        let pos = currentLightIndex;
        let rounds = 0;
        const totalRounds = 3;

        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            const prev = document.getElementById(`slot-${pos}`);
            if(prev) prev.classList.remove('active');

            pos++;
            if (pos >= boardConfig.length) pos = 0;
            if (pos === 0) rounds++;

            const curr = document.getElementById(`slot-${pos}`);
            if(curr) curr.classList.add('active');

            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && pos !== targetIndex) {
                speed += 20;
                setTimeout(step, speed);
            } else if (pos === targetIndex) {
                endGame(winAmount, winnerId, pos);
                resolve();
            } else {
                setTimeout(step, speed);
            }
        };
        step();
    });
}

function endGame(winAmount, winnerId, index) {
    isSpinning = false;
    spinBtn.disabled = false;
    currentLightIndex = index;
    updateBalance();

    if (winAmount > 0) {
        winDisplay.textContent = `R$ ${winAmount.toFixed(2)}`;
        // Mensagem em duas linhas para caber melhor
        resultMessage.innerHTML = `${ASSETS[winnerId].name}<br>WIN!`;
        resultMessage.classList.remove('hidden');
        
        const slot = document.getElementById(`slot-${index}`);
        slot.classList.add('active');

        // --- DISPARAR CONFETES! ---
        // Usa a biblioteca carregada no HTML
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }, // Explode um pouco abaixo do centro
            colors: ['#3b82f6', '#f59e0b', '#10b981', '#ffffff'] // Cores do tema
        });
    }
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await fetch('/api/reset', {method:'POST'});
    const data = await res.json();
    balance = data.balance;
    updateBalance();
    winDisplay.textContent = "R$ 0.00";
    resultMessage.classList.add('hidden');
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('input').forEach(i => i.value = '');
});

init();
