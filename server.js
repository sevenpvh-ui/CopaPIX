const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- SALDO EM MEMÓRIA ---
let mockUser = { balance: 1000.00 };

// --- CONFIGURAÇÃO DO TABULEIRO (20 Posições: 0 a 19) ---
// Times: Brasil, Argentina, França, Alemanha, Espanha, Inglaterra, Portugal, Croácia
// Multiplicadores baseados na raridade (fictícia para o jogo)
const BOARD = [
    { id: 'bra', name: 'Brasil', mult: 5 },      // 0
    { id: 'arg', name: 'Argentina', mult: 5 },   // 1
    { id: 'fra', name: 'França', mult: 5 },      // 2
    { id: 'ger', name: 'Alemanha', mult: 10 },   // 3
    { id: 'bra', name: 'Brasil', mult: 5 },      // 4
    { id: 'spa', name: 'Espanha', mult: 10 },    // 5
    { id: 'eng', name: 'Inglaterra', mult: 10 }, // 6
    { id: 'por', name: 'Portugal', mult: 10 },   // 7
    { id: 'arg', name: 'Argentina', mult: 5 },   // 8
    { id: 'cro', name: 'Croácia', mult: 20 },    // 9 (Raro)
    { id: 'bra', name: 'Brasil', mult: 5 },      // 10
    { id: 'fra', name: 'França', mult: 5 },      // 11
    { id: 'ger', name: 'Alemanha', mult: 10 },   // 12
    { id: 'por', name: 'Portugal', mult: 10 },   // 13
    { id: 'arg', name: 'Argentina', mult: 5 },   // 14
    { id: 'spa', name: 'Espanha', mult: 10 },    // 15
    { id: 'eng', name: 'Inglaterra', mult: 10 }, // 16
    { id: 'cro', name: 'Croácia', mult: 20 },    // 17 (Raro)
    { id: 'bra', name: 'Brasil', mult: 5 },      // 18
    { id: 'fra', name: 'França', mult: 5 },      // 19
];

// Retorna as configurações do jogo para o frontend montar o tabuleiro
app.get('/api/config', (req, res) => {
    res.json({ board: BOARD, balance: mockUser.balance });
});

// Girar a Roleta
app.post('/api/spin', (req, res) => {
    const { bets } = req.body; // Objeto ex: { 'bra': 10, 'arg': 5 }
    
    // 1. Calcular aposta total
    let totalBet = 0;
    for (const team in bets) {
        totalBet += (parseFloat(bets[team]) || 0);
    }

    if (totalBet <= 0) return res.status(400).json({ error: "Faça uma aposta!" });
    if (totalBet > mockUser.balance) return res.status(400).json({ error: "Saldo insuficiente!" });

    // 2. Debitar saldo
    mockUser.balance -= totalBet;

    // 3. Sorteio (RNG)
    // Sorteia um índice de 0 a 19 (tamanho do board)
    const resultIndex = Math.floor(Math.random() * BOARD.length);
    const resultSlot = BOARD[resultIndex];

    // 4. Calcular Vitória
    // O usuário ganha se apostou no time que caiu
    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    let winAmount = 0;

    if (betOnWinner > 0) {
        winAmount = betOnWinner * resultSlot.mult;
        mockUser.balance += winAmount;
    }

    res.json({
        resultIndex: resultIndex, // Onde a luz para
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
app.listen(PORT, () => console.log(`⚽ Copa Slot rodando na porta ${PORT}`));
