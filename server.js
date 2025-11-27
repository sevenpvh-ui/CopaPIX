const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- SALDO EM MEMÓRIA ---
let mockUser = { balance: 1000.00 };

// --- CONFIGURAÇÃO DO TABULEIRO (24 Posições para o layout retrô) ---
// Times: Brasil, Argentina, França, Alemanha, Espanha, Inglaterra, Portugal, Croácia
const BOARD = [
    // Topo (7)
    { id: 'bra', name: 'Brasil', mult: 5 },      // 0
    { id: 'arg', name: 'Argentina', mult: 5 },   // 1
    { id: 'fra', name: 'França', mult: 5 },      // 2
    { id: 'ger', name: 'Alemanha', mult: 10 },   // 3
    { id: 'spa', name: 'Espanha', mult: 10 },    // 4
    { id: 'eng', name: 'Inglaterra', mult: 10 }, // 5
    { id: 'por', name: 'Portugal', mult: 10 },   // 6
    // Direita (5)
    { id: 'cro', name: 'Croácia', mult: 25 },    // 7 (Raro)
    { id: 'bra', name: 'Brasil', mult: 5 },      // 8
    { id: 'arg', name: 'Argentina', mult: 5 },   // 9
    { id: 'fra', name: 'França', mult: 5 },      // 10
    { id: 'ger', name: 'Alemanha', mult: 10 },   // 11
    // Baixo (7)
    { id: 'spa', name: 'Espanha', mult: 10 },    // 12
    { id: 'eng', name: 'Inglaterra', mult: 10 }, // 13
    { id: 'por', name: 'Portugal', mult: 10 },   // 14
    { id: 'cro', name: 'Croácia', mult: 25 },    // 15 (Raro)
    { id: 'bra', name: 'Brasil', mult: 5 },      // 16
    { id: 'arg', name: 'Argentina', mult: 5 },   // 17
    { id: 'fra', name: 'França', mult: 5 },      // 18
    // Esquerda (5)
    { id: 'ger', name: 'Alemanha', mult: 10 },   // 19
    { id: 'spa', name: 'Espanha', mult: 10 },    // 20
    { id: 'eng', name: 'Inglaterra', mult: 10 }, // 21
    { id: 'por', name: 'Portugal', mult: 10 },   // 22
    { id: 'cro', name: 'Croácia', mult: 25 },    // 23
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

    // Sorteia índice de 0 a 23
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
app.listen(PORT, () => console.log(`⚽ Copa 98 Retrô rodando na porta ${PORT}`));
