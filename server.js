const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- DADOS ---
let usersDB = {}; 
let houseStats = { totalIn: 0, totalOut: 0, houseProfit: 0, prizePool: 0 };
// NOVO: Array para guardar as últimas 15 vitórias
let gameHistory = []; 

// CONFIG ADMIN
const ADMIN_PASSWORD = "admin"; 
const POOL_TARGET = 100.00;     
const POOL_PERCENT = 0.20;      

const BOARD = [
    { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 },
    { id: 'eng', mult: 5 }, { id: 'ger', mult: 10 },
    { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 },
    { id: 'ned', mult: 10 }, { id: 'cro', mult: 25 }
];

let nextSpinMustWin = false;

// Envia o histórico junto com a config
app.get('/api/config', (req, res) => {
    res.json({ board: BOARD, history: gameHistory });
});

app.post('/api/auth', (req, res) => {
    const { cpf, password, type } = req.body;
    if (!cpf || !password) return res.status(400).json({ error: "Preencha tudo" });
    if (type === 'register') {
        if (usersDB[cpf]) return res.status(400).json({ error: "CPF já existe" });
        usersDB[cpf] = { password, balance: 1000.00 };
        return res.json({ success: true, balance: 1000.00 });
    }
    if (type === 'login') {
        const user = usersDB[cpf];
        if (!user || user.password !== password) return res.status(400).json({ error: "Erro no login" });
        return res.json({ success: true, balance: user.balance });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if(password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: "Senha incorreta" });
});

app.get('/api/admin/stats', (req, res) => {
    res.json({ stats: houseStats, usersCount: Object.keys(usersDB).length, poolTarget: POOL_TARGET, nextRigged: nextSpinMustWin });
});

app.post('/api/admin/action', (req, res) => {
    const { action } = req.body;
    if(action === 'force_win') { nextSpinMustWin = true; return res.json({ msg: "Vitória Forçada!" }); }
    if(action === 'reset_stats') { houseStats = { totalIn: 0, totalOut: 0, houseProfit: 0, prizePool: 0 }; return res.json({ msg: "Zerado!" }); }
});

app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Login necessário" });

    let totalBet = 0;
    let highestBetTeam = null;
    let highestBetValue = 0;

    for (const t in bets) {
        const val = parseFloat(bets[t]) || 0;
        if (val > 0) {
            totalBet += val;
            if(val > highestBetValue) { highestBetValue = val; highestBetTeam = t; }
        }
    }

    if (totalBet <= 0 || totalBet > user.balance) return res.status(400).json({ error: "Inválido" });

    user.balance -= totalBet;
    houseStats.totalIn += totalBet;
    houseStats.houseProfit += totalBet;
    houseStats.prizePool += (totalBet * POOL_PERCENT);

    let resultIndex, resultSlot, isForcedWin = false;

    if (nextSpinMustWin || houseStats.prizePool >= POOL_TARGET) {
        if (highestBetTeam) {
            const winningIndices = [];
            BOARD.forEach((slot, idx) => { if(slot.id === highestBetTeam) winningIndices.push(idx); });
            if(winningIndices.length > 0) {
                resultIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
                resultSlot = BOARD[resultIndex];
                isForcedWin = true;
                nextSpinMustWin = false;
                if(houseStats.prizePool >= POOL_TARGET) houseStats.prizePool = 0;
            }
        }
    }

    if (!isForcedWin) {
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];
    }

    // --- ATUALIZA HISTÓRICO ---
    // Adiciona no começo do array
    gameHistory.unshift(resultSlot.id);
    // Mantém apenas os últimos 15
    if (gameHistory.length > 15) gameHistory.pop();

    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) {
        user.balance += winAmount;
        houseStats.totalOut += winAmount;
        houseStats.houseProfit -= winAmount;
    }

    res.json({
        resultIndex,
        winnerId: resultSlot.id,
        winAmount,
        newBalance: user.balance,
        history: gameHistory // Envia o histórico atualizado
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
