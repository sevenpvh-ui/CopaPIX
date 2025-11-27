const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let mockUser = { balance: 1000.00 };

// CONFIGURAÇÃO DOS TIMES
// IDs curtos: bra, fra, eng, ger, spa, por, ned (Holanda), cro
const BOARD = [
    // Topo (7 slots)
    { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },

    // Direita (5 slots)
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 },
    { id: 'eng', mult: 5 }, { id: 'ger', mult: 10 },

    // Baixo (7 slots - reverso)
    { id: 'spa', mult: 10 }, { id: 'por', mult: 10 }, { id: 'ned', mult: 10 },
    { id: 'cro', mult: 25 }, { id: 'bra', mult: 5 }, { id: 'fra', mult: 5 }, { id: 'eng', mult: 5 },

    // Esquerda (5 slots - reverso)
    { id: 'ger', mult: 10 }, { id: 'spa', mult: 10 }, { id: 'por', mult: 10 },
    { id: 'ned', mult: 10 }, { id: 'cro', mult: 25 }
];

app.get('/api/config', (req, res) => {
    res.json({ board: BOARD, balance: mockUser.balance });
});

app.post('/api/spin', (req, res) => {
    const { bets } = req.body;
    let totalBet = 0;
    for (const t in bets) totalBet += (parseFloat(bets[t]) || 0);

    if (totalBet <= 0) return res.status(400).json({ error: "Faça uma aposta!" });
    if (totalBet > mockUser.balance) return res.status(400).json({ error: "Saldo insuficiente" });

    mockUser.balance -= totalBet;

    const resultIndex = Math.floor(Math.random() * BOARD.length);
    const resultSlot = BOARD[resultIndex];
    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) mockUser.balance += winAmount;

    res.json({
        resultIndex,
        winnerId: resultSlot.id,
        winAmount,
        newBalance: mockUser.balance
    });
});

app.post('/api/reset', (req, res) => {
    mockUser.balance = 1000;
    res.json({ balance: 1000 });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
