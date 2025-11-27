// MAPA DE EMOJIS (Nunca quebra e carrega instantâneo)
const TEAM_ASSETS = {
    'bra': { flag: '🇧🇷', color: '#009c3b' },
    'arg': { flag: '🇦🇷', color: '#75aadb' },
    'fra': { flag: '🇫🇷', color: '#0055a4' },
    'ger': { flag: '🇩🇪', color: '#dd0000' },
    'spa': { flag: '🇪🇸', color: '#aa151b' },
    'eng': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: '#cf081f' },
    'por': { flag: '🇵🇹', color: '#ff0000' },
    'cro': { flag: '🇭🇷', color: '#ff0000' }
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
    const res = await fetch('/api/config');
    const data = await res.json();
    boardConfig = data.board;
    balance = data.balance;
    updateBalance();
    renderBoard();
    renderBettingControls();
}

function updateBalance() {
    creditDisplay.textContent = balance.toFixed(2);
}

function renderBoard() {
    // Mapeamento para Grid 7x8
    const coords = [
        // Topo (0-6)
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
        // Direita (7-11)
        [2,7], [3,7], [4,7], [5,7], [6,7],
        // Baixo (12-18) reverso
        [8,7], [8,6], [8,5], [8,4], [8,3], [8,2], [8,1],
        // Esquerda (19-23) reverso
        [6,1], [5,1], [4,1], [3,1], [2,1]
    ];

    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        
        const asset = TEAM_ASSETS[slot.id];
        // Visual Minimalista: Bandeira Emoji + Multiplicador
        div.innerHTML = `
            <div style="font-size: 1.8rem">${asset.flag}</div>
            <span style="color: ${asset.color}">x${slot.mult}</span>
        `;
        
        if (coords[index]) {
            div.style.gridRow = coords[index][0];
            div.style.gridColumn = coords[index][1];
        }
        boardGrid.appendChild(div);
    });
}

function renderBettingControls() {
    const uniqueTeams = {};
    boardConfig.forEach(s => { if(!uniqueTeams[s.id]) uniqueTeams[s.id] = s; });

    for (const id in uniqueTeams) {
        const team = uniqueTeams[id];
        const asset = TEAM_ASSETS[id];
        
        const div = document.createElement('div');
        div.className = 'bet-card';
        div.innerHTML = `
            <label>${asset.flag}</label>
            <small>x${team.mult}</small>
            <input type="number" data-team="${id}" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;

    const inputs = document.querySelectorAll('.bet-card input');
    const bets = {};
    let totalBet = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value) || 0;
        if (val > 0) {
            bets[inp.dataset.team] = val;
            totalBet += val;
        }
    });

    if (totalBet === 0) return alert("Escolha um time para apostar!");
    if (totalBet > balance) return alert("Saldo insuficiente!");

    isSpinning = true;
    spinBtn.disabled = true;
    resultMessage.classList.add('hidden');
    winDisplay.textContent = "0.00";

    try {
        const res = await fetch('/api/spin', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bets })
        });
        const data = await res.json();

        if (data.error) {
            alert(data.error); isSpinning = false; spinBtn.disabled = false; return;
        }

        balance = data.newBalance; 
        updateBalance(); // Atualiza saldo visualmente (já debitado)

        await runAnimation(data.resultIndex, data.winAmount, data.winnerTeam);

    } catch (e) {
        console.error(e); isSpinning = false; spinBtn.disabled = false;
    }
});

function runAnimation(targetIndex, winAmount, winnerName) {
    return new Promise(resolve => {
        let speed = 50;
        let position = currentLightIndex;
        let rounds = 0;
        const totalRounds = 3;

        // Limpa tudo
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            // Apaga anterior
            const prev = document.getElementById(`slot-${position}`);
            if(prev) prev.classList.remove('active');

            // Move
            position++;
            if (position >= boardConfig.length) {
                position = 0;
                rounds++;
            }

            // Acende novo
            const curr = document.getElementById(`slot-${position}`);
            if(curr) curr.classList.add('active');
            
            // Controle de velocidade
            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && position !== targetIndex) {
                speed += 20; // Desacelera no final
                setTimeout(step, speed);
            } else if (position === targetIndex) {
                endGame(winAmount, winnerName, position);
                resolve();
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
        winDisplay.textContent = winAmount.toFixed(2);
        const asset = TEAM_ASSETS[boardConfig[finalIndex].id];
        
        resultMessage.innerHTML = `${asset.flag}<br>GANHOU!`;
        resultMessage.classList.remove('hidden');
        
        // Efeito piscante de vitória
        const slot = document.getElementById(`slot-${finalIndex}`);
        slot.classList.add('active');
    }
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await fetch('/api/reset', {method:'POST'});
    const data = await res.json();
    balance = data.balance;
    updateBalance();
    winDisplay.textContent = "0.00";
    resultMessage.classList.add('hidden');
    document.querySelectorAll('.bet-card input').forEach(i => i.value = '');
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
});

init();
