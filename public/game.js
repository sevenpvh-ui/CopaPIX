// MAPA DE ASSETS (EMOJIS)
// Isso garante que nunca mais teremos imagens quebradas.
const ASSETS = {
    'bra': { emoji: '🇧🇷', name: 'Brasil' },
    'fra': { emoji: '🇫🇷', name: 'França' },
    'eng': { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'Inglaterra' },
    'ger': { emoji: '🇩🇪', name: 'Alemanha' },
    'spa': { emoji: '🇪🇸', name: 'Espanha' },
    'por': { emoji: '🇵🇹', name: 'Portugal' },
    'ned': { emoji: '🇳🇱', name: 'Holanda' }, // Corrigido!
    'cro': { emoji: '🇭🇷', name: 'Croácia' }
};

let boardConfig = [];
let balance = 0;
let isSpinning = false;
let currentLightIndex = 0;

// Elementos
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
    // Mapeamento Grid 7x7 (Sentido Horário)
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
    // Pegar times únicos para criar os inputs
    const unique = {};
    boardConfig.forEach(s => { if(!unique[s.id]) unique[s.id] = s; });

    for (const id in unique) {
        const team = unique[id];
        const asset = ASSETS[id];
        
        const div = document.createElement('div');
        div.className = 'bet-chip';
        div.innerHTML = `
            <div style="font-size: 1.4rem;">${asset.emoji}</div>
            <span style="font-size: 0.7rem; color: #71717a;">x${team.mult}</span>
            <input type="number" data-id="${id}" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;

    // Coletar apostas
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
        updateBalance(); // Atualiza saldo visualmente (já debitado)

        await runAnimation(data.resultIndex, data.winAmount, data.winnerId);

    } catch(e) { console.error(e); isSpinning = false; spinBtn.disabled = false; }
});

function runAnimation(targetIndex, winAmount, winnerId) {
    return new Promise(resolve => {
        let speed = 50;
        let pos = currentLightIndex;
        let rounds = 0;
        const totalRounds = 3;

        // Limpa luzes
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            // Apaga anterior
            const prev = document.getElementById(`slot-${pos}`);
            if(prev) prev.classList.remove('active');

            // Move
            pos++;
            if (pos >= boardConfig.length) pos = 0;
            if (pos === 0) rounds++;

            // Acende atual
            const curr = document.getElementById(`slot-${pos}`);
            if(curr) curr.classList.add('active');

            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && pos !== targetIndex) {
                speed += 20; // Desacelera
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
        resultMessage.innerHTML = `${ASSETS[winnerId].name}<br>WIN!`;
        resultMessage.classList.remove('hidden');
        
        // Efeito extra no slot vencedor
        const slot = document.getElementById(`slot-${index}`);
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
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('input').forEach(i => i.value = '');
});

init();
