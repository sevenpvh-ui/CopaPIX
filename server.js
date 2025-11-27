const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let mockUser = { balance: 1000.00 };

// --- TIMES SELECIONADOS (Top 8 da sua lista) ---
// Multiplicadores: Times muito fortes pagam menos (mais chance de sair), zebras pagam mais.
const BOARD = [
    // Topo (0-6)
    { id: 'bra', name: 'Brasil', mult: 5 },
    { id: 'fra', name: 'França', mult: 5 },
    { id: 'eng', name: 'Inglaterra', mult: 5 },
    { id: 'ger', name: 'Alemanha', mult: 10 },
    { id: 'spa', name: 'Espanha', mult: 10 },
    { id: 'por', name: 'Portugal', mult: 10 },
    { id: 'ned', name: 'Holanda', mult: 10 },

    // Direita (7-11)
    { id: 'cro', name: 'Croácia', mult: 25 }, // Jackpot
    { id: 'bra', name: 'Brasil', mult: 5 },
    { id: 'fra', name: 'França', mult: 5 },
    { id: 'eng', name: 'Inglaterra', mult: 5 },
    { id: 'ger', name: 'Alemanha', mult: 10 },

    // Baixo (12-18)
    { id: 'spa', name: 'Espanha', mult: 10 },
    { id: 'por', name: 'Portugal', mult: 10 },
    { id: 'ned', name: 'Holanda', mult: 10 },
    { id: 'cro', name: 'Croácia', mult: 25 }, // Jackpot
    { id: 'bra', name: 'Brasil', mult: 5 },
    { id: 'fra', name: 'França', mult: 5 },
    { id: 'eng', name: 'Inglaterra', mult: 5 },

    // Esquerda (19-23)
    { id: 'ger', name: 'Alemanha', mult: 10 },
    { id: 'spa', name: 'Espanha', mult: 10 },
    { id: 'por', name: 'Portugal', mult: 10 },
    { id: 'ned', name: 'Holanda', mult: 10 },
    { id: 'cro', name: 'Croácia', mult: 25 }, // Jackpot
];

app.get('/api/config', (req, res) => {
    res.json({ board: BOARD, balance: mockUser.balance });
});

app.post('/api/spin', (req, res) => {
    const { bets } = req.body; 
    let totalBet = 0;
    for (const team in bets) { totalBet += (parseFloat(bets[team]) || 0); }

    if (totalBet <= 0) return res.status(400).json({ error: "Faça uma aposta!" });
    if (totalBet > mockUser.balance) return res.status(400).json({ error: "Saldo insuficiente!" });

    mockUser.balance -= totalBet;

    // Sorteio
    const resultIndex = Math.floor(Math.random() * BOARD.length);
    const resultSlot = BOARD[resultIndex];

    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    let winAmount = 0;

    if (betOnWinner > 0) {
        winAmount = betOnWinner * resultSlot.mult;
        mockUser.balance += winAmount;
    }

    res.json({
        resultIndex: resultIndex,
        winnerTeam: resultSlot.name,
        winAmount: winAmount,
        newBalance: mockUser.balance
    });
});

app.post('/api/reset', (req, res) => {
    mockUser.balance = 1000;
    res.json({ balance: 1000 });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`⚽ Global Cup rodando na porta ${PORT}`));
