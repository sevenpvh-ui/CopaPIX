const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- BANCO DE DADOS EM MEMÓRIA (Temporário) ---
// Formato: { '12345678900': { pass: '123', balance: 1000 } }
const usersDB = {}; 

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

app.get('/api/config', (req, res) => {
    res.json({ board: BOARD });
});

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/auth', (req, res) => {
    const { cpf, password, type } = req.body; // type = 'login' ou 'register'

    if (!cpf || !password) return res.status(400).json({ error: "Preencha tudo!" });

    if (type === 'register') {
        if (usersDB[cpf]) return res.status(400).json({ error: "CPF já cadastrado!" });
        // Cria usuário com 1000 de bônus
        usersDB[cpf] = { password, balance: 1000.00 };
        return res.json({ success: true, balance: 1000.00, msg: "Conta criada!" });
    }

    if (type === 'login') {
        const user = usersDB[cpf];
        if (!user || user.password !== password) {
            return res.status(400).json({ error: "CPF ou Senha incorretos" });
        }
        return res.json({ success: true, balance: user.balance });
    }
});

// --- ROTA DE JOGO (Agora exige CPF) ---
app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    
    // Validação simples
    const user = usersDB[cpf];
    if (!user) return res.status(401).json({ error: "Não autorizado" });

    let totalBet = 0;
    for (const t in bets) totalBet += (parseFloat(bets[t]) || 0);

    if (totalBet <= 0) return res.status(400).json({ error: "Aposta inválida" });
    if (totalBet > user.balance) return res.status(400).json({ error: "Saldo insuficiente" });

    // Debita
    user.balance -= totalBet;

    const resultIndex = Math.floor(Math.random() * BOARD.length);
    const resultSlot = BOARD[resultIndex];
    const betOnWinner = parseFloat(bets[resultSlot.id]) || 0;
    const winAmount = betOnWinner > 0 ? betOnWinner * resultSlot.mult : 0;

    if (winAmount > 0) user.balance += winAmount;

    res.json({
        resultIndex,
        winnerId: resultSlot.id,
        winAmount,
        newBalance: user.balance
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Auth rodando na porta ${PORT}`));
