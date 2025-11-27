// Bandeiras SVG (Nunca quebram)
const FLAG_IMGS = {
    'bra': 'https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg',
    'arg': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Flag_of_Argentina.svg',
    'fra': 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Flag_of_France.svg',
    'ger': 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Flag_of_Germany.svg',
    'spa': 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Flag_of_Spain.svg',
    'eng': 'https://upload.wikimedia.org/wikipedia/commons/b/be/Flag_of_England.svg',
    'por': 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg',
    'cro': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Flag_of_Croatia.svg'
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
        renderBettingControls();
    } catch (e) { console.error("Erro ao iniciar", e); }
}

function updateBalance() {
    creditDisplay.textContent = balance.toString().padStart(4, '0');
}

function renderBoard() {
    // CORREÇÃO: Coordenadas ajustadas para Grid 7x7
    // Total 24 Itens: 7 Topo + 7 Baixo + 5 Esquerda + 5 Direita
    const coords = [
        // Topo (0-6) - Linha 1
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
        
        // Direita (7-11) - Coluna 7 (Linhas 2,3,4,5,6)
        [2,7], [3,7], [4,7], [5,7], [6,7],
        
        // Baixo (12-18) - Linha 7 (Antes era 8, aqui estava o erro!)
        [7,7], [7,6], [7,5], [7,4], [7,3], [7,2], [7,1],
        
        // Esquerda (19-23) - Coluna 1 (Linhas 6,5,4,3,2)
        [6,1], [5,1], [4,1], [3,1], [2,1]
    ];

    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        // Usa a imagem da bandeira
        div.innerHTML = `<img src="${FLAG_IMGS[slot.id]}" alt="${slot.name}">`;
        
        // Aplica a posição se existir
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
        const div = document.createElement('div');
        div.className = 'bet-item';
        div.innerHTML = `
            <img src="${FLAG_IMGS[id]}" class="bet-flag-label">
            <small>x${team.mult}</small>
            <input type="number" data-team="${id}" value="" placeholder="0" />
        `;
        betControls.appendChild(div);
    }
}

spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;

    const inputs = document.querySelectorAll('.bet-item input');
    const bets = {};
    let totalBet = 0;

    inputs.forEach(inp => {
        const val = parseInt(inp.value) || 0;
        if (val > 0) {
            bets[inp.dataset.team] = val;
            totalBet += val;
        }
    });

    if (totalBet === 0) return alert("Faça uma aposta!");
    if (totalBet > balance) return alert("Saldo insuficiente!");

    isSpinning = true;
    spinBtn.disabled = true;
    resultMessage.classList.add('hidden');
    winDisplay.textContent = "0000";

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
        updateBalance(); 

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

        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            const prev = document.getElementById(`slot-${position}`);
            if(prev) prev.classList.remove('active');

            position++;
            if (position >= boardConfig.length) {
                position = 0;
                rounds++;
            }

            const curr = document.getElementById(`slot-${position}`);
            if(curr) curr.classList.add('active');
            
            if (rounds < totalRounds) {
                setTimeout(step, speed);
            } else if (rounds === totalRounds && position !== targetIndex) {
                speed += 20;
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
        winDisplay.textContent = winAmount.toString().padStart(4, '0');
        resultMessage.textContent = `VENCEU!`;
        resultMessage.classList.remove('hidden');
        
        const slot = document.getElementById(`slot-${finalIndex}`);
        let flashCount = 0;
        const flash = setInterval(() => {
            slot.classList.toggle('active');
            flashCount++;
            if(flashCount > 10) { clearInterval(flash); slot.classList.add('active'); }
        }, 150);
    }
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await fetch('/api/reset', {method:'POST'});
    const data = await res.json();
    balance = data.balance;
    updateBalance();
    winDisplay.textContent = "0000";
    resultMessage.classList.add('hidden');
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('input').forEach(i => i.value = '');
});

init();
