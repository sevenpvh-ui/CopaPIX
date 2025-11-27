// Configuração Visual (Mapas de Bandeiras)
const FLAG_EMOJIS = {
    'bra': '🇧🇷', 'arg': '🇦🇷', 'fra': '🇫🇷', 'ger': '🇩🇪',
    'spa': '🇪🇸', 'eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'por': '🇵🇹', 'cro': '🇭🇷'
};

// Variáveis Globais
let boardConfig = [];
let balance = 0;
let isSpinning = false;
let currentLightIndex = 0;

// Elementos DOM
const boardGrid = document.getElementById('boardGrid');
const creditDisplay = document.getElementById('creditDisplay');
const winDisplay = document.getElementById('winDisplay');
const betControls = document.getElementById('betControls');
const spinBtn = document.getElementById('spinBtn');
const resultMessage = document.getElementById('resultMessage');

// Inicialização
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

// 1. Renderizar o Tabuleiro (Posicionamento no Grid)
function renderBoard() {
    // Vamos mapear os índices do array (0 a 19) para posições no CSS Grid 6x6
    // Topo (0-5): Row 1, Cols 1-6
    // Direita (6-8): Row 2-4, Col 6
    // Baixo (9-14): Row 6, Cols 6-1 (Reverso)
    // Esquerda (15-17): Row 5-3, Col 1 (Reverso)
    // Faltam os cantos? Não, 6+3+6+3 = 18? Vamos ajustar.
    // O Board tem 20 itens.
    // Topo: 6 itens (Col 1 a 6). Direita: 4 itens (Row 2 a 5). Baixo: 6 itens (Col 6 a 1). Esquerda: 4 itens (Row 5 a 2).
    // Total = 6 + 4 + 6 + 4 = 20. Perfeito.
    
    // Lista de coordenadas [row, col] para cada índice de 0 a 19
    const coords = [
        [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], // Topo (0-5)
        [2,6], [3,6], [4,6], [5,6],               // Direita (6-9)
        [6,6], [6,5], [6,4], [6,3], [6,2], [6,1], // Baixo (10-15) - Reverso visual
        [5,1], [4,1], [3,1], [2,1]                // Esquerda (16-19)
    ];

    boardConfig.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.id = `slot-${index}`;
        div.innerHTML = `${FLAG_EMOJIS[slot.id]} <span>x${slot.mult}</span>`;
        
        // Aplica posição Grid
        if (coords[index]) {
            div.style.gridRow = coords[index][0];
            div.style.gridColumn = coords[index][1];
        }
        
        boardGrid.appendChild(div);
    });
}

// 2. Renderizar Controles de Aposta (Apenas uma vez por país)
function renderBettingControls() {
    // Pega times únicos
    const uniqueTeams = {};
    boardConfig.forEach(s => {
        if(!uniqueTeams[s.id]) uniqueTeams[s.id] = s;
    });

    for (const id in uniqueTeams) {
        const team = uniqueTeams[id];
        const div = document.createElement('div');
        div.className = 'bet-item';
        div.innerHTML = `
            <label>${FLAG_EMOJIS[id]}</label>
            <small>x${team.mult}</small>
            <input type="number" data-team="${id}" value="0" min="0" />
        `;
        betControls.appendChild(div);
    }
}

// 3. Lógica do Giro
spinBtn.addEventListener('click', async () => {
    if (isSpinning) return;

    // Coleta as apostas
    const inputs = document.querySelectorAll('.bet-item input');
    const bets = {};
    let totalBet = 0;

    inputs.forEach(inp => {
        const val = parseFloat(inp.value);
        if (val > 0) {
            bets[inp.dataset.team] = val;
            totalBet += val;
        }
    });

    if (totalBet === 0) return alert("Faça uma aposta!");

    // Bloqueia
    isSpinning = true;
    spinBtn.disabled = true;
    resultMessage.classList.add('hidden');
    winDisplay.textContent = "0000";

    try {
        // Chama API
        const res = await fetch('/api/spin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bets })
        });
        const data = await res.json();

        if (data.error) {
            alert(data.error);
            isSpinning = false;
            spinBtn.disabled = false;
            return;
        }

        // Atualiza saldo visualmente (subtrai aposta)
        creditDisplay.textContent = (balance - totalBet).toFixed(2);

        // Inicia Animação da Luz
        await runAnimation(data.resultIndex, data.winAmount, data.winnerTeam, data.newBalance);

    } catch (e) {
        console.error(e);
        isSpinning = false;
        spinBtn.disabled = false;
    }
});

function runAnimation(targetIndex, winAmount, winnerName, finalBalance) {
    return new Promise(resolve => {
        let speed = 50; // Começa rápido
        let position = currentLightIndex;
        let rounds = 0;
        const totalRounds = 3; // Voltas completas antes de parar

        // Limpa luz anterior
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));

        const step = () => {
            // Remove do anterior
            const prev = document.getElementById(`slot-${position}`);
            if(prev) prev.classList.remove('active');

            // Move próximo
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
                // Primeiras voltas: velocidade constante
                setTimeout(step, speed);
            } else if (rounds === totalRounds && position !== targetIndex) {
                // Última volta: desacelera
                speed += 15; // Vai ficando mais lento
                setTimeout(step, speed);
            } else if (position === targetIndex) {
                // CHEGOU!
                endGame(winAmount, winnerName, finalBalance, position);
                resolve();
            } else {
                // Caso de segurança
                setTimeout(step, speed);
            }
        };

        step();
    });
}

function endGame(winAmount, winnerName, finalBalance, finalIndex) {
    isSpinning = false;
    spinBtn.disabled = false;
    currentLightIndex = finalIndex;
    balance = finalBalance;
    updateBalance();

    if (winAmount > 0) {
        winDisplay.textContent = winAmount.toFixed(2);
        resultMessage.textContent = `VENCEU! ${FLAG_EMOJIS[boardConfig[finalIndex].id]}`;
        resultMessage.classList.remove('hidden');
        
        // Efeito piscante no vencedor
        const slot = document.getElementById(`slot-${finalIndex}`);
        let flashCount = 0;
        const flash = setInterval(() => {
            slot.classList.toggle('active');
            flashCount++;
            if(flashCount > 10) clearInterval(flash);
        }, 200);
    } else {
        resultMessage.textContent = "Tente de novo!";
        resultMessage.classList.remove('hidden');
    }
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const res = await fetch('/api/reset', {method:'POST'});
    const data = await res.json();
    balance = data.balance;
    updateBalance();
    winDisplay.textContent = "0000";
    resultMessage.classList.add('hidden');
    document.querySelectorAll('input').forEach(i => i.value = 0);
});

// Iniciar
init();
