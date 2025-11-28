const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- DADOS NA MEMÓRIA (Temporário até ligar o Banco) ---
let usersDB = {}; 
let houseStats = {
    totalIn: 0,       // Total apostado
    totalOut: 0,      // Total pago em prêmios
    houseProfit: 0,   // Lucro líquido
    prizePool: 0      // O "Pote" dos 20%
};
let gameHistory = []; 
// NOVO: Fila de saques pendentes
let withdrawalsQueue = []; 

// CONFIGURAÇÕES DO ADMIN
const ADMIN_PASSWORD = "admin"; 
const POOL_TARGET = 100.00;     // Meta para soltar o prêmio
const POOL_PERCENT = 0.20;      // 20% vai para o pote

// TABULEIRO
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

// Variável de controle do Admin (Vitória Forçada)
let nextSpinMustWin = false;

// --- ROTA DE CONFIGURAÇÃO (Frontend chama ao iniciar) ---
app.get('/api/config', (req, res) => {
    res.json({ board: BOARD, history: gameHistory });
});

// --- ROTA DE AUTENTICAÇÃO (Login e Cadastro) ---
app.post('/api/auth', (req, res) => {
    const { cpf, password, type, name, phone } = req.body;
    
    if (!cpf || !password) return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });

    if (type === 'register') {
        if (usersDB[cpf]) return res.status(400).json({ error: "CPF já cadastrado. Faça login." });
        if (!name || !phone) return res.status(400).json({ error: "Nome e Telefone são obrigatórios." });
        
        // Cria usuário
        usersDB[cpf] = { 
            password, 
            name, 
            phone,
            balance: 20.00 // Bônus inicial
        };
        return res.json({ success: true, balance: 20.00, name });
    }

    if (type === 'login') {
        const user = usersDB[cpf];
        if (!user || user.password !== password) return res.status(400).json({ error: "CPF ou Senha incorretos." });
        return res.json({ success: true, balance: user.balance, name: user.name });
    }
});

// --- ROTA DE DEPÓSITO (Simulação) ---
app.post('/api/deposit', (req, res) => {
    const { cpf, amount } = req.body;
    const user = usersDB[cpf];
    
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    if (!amount || amount <= 0) return res.status(400).json({ error: "Valor inválido." });

    user.balance += parseFloat(amount);
    houseStats.totalIn += parseFloat(amount); // Entra para estatística da casa

    res.json({ success: true, newBalance: user.balance });
});

// --- ROTA DE SOLICITAÇÃO DE SAQUE ---
app.post('/api/withdraw', (req, res) => {
    const { cpf, amount, pixKey } = req.body;
    const user = usersDB[cpf];
    
    if (!user) return res.status(401).json({ error: "Sessão inválida." });
    if (amount <= 0) return res.status(400).json({ error: "Valor inválido." });
    if (user.balance < amount) return res.status(400).json({ error: "Saldo insuficiente." });

    // Deduz do saldo IMEDIATAMENTE para evitar gasto duplo
    user.balance -= parseFloat(amount);
    
    // Adiciona na fila do Admin
    const request = {
        id: Date.now(), // ID único baseado no tempo
        cpf,
        name: user.name,
        amount: parseFloat(amount),
        pixKey,
        date: new Date().toLocaleString('pt-BR')
    };
    withdrawalsQueue.push(request);

    res.json({ success: true, newBalance: user.balance });
});

// --- ROTAS DO ADMIN ---
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if(password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ error: "Senha incorreta." });
});

app.get('/api/admin/stats', (req, res) => {
    // Retorna tudo que o painel precisa saber
    res.json({ 
        stats: houseStats, 
        usersCount: Object.keys(usersDB).length, 
        poolTarget: POOL_TARGET, 
        nextRigged: nextSpinMustWin,
        withdrawals: withdrawalsQueue // Manda a fila de saques
    });
});

app.post('/api/admin/action', (req, res) => {
    const { action, id } = req.body;
    
    if(action === 'force_win') {
        nextSpinMustWin = true;
        return res.json({ msg: "Próxima rodada será VITÓRIA!" });
    }
    
    if(action === 'reset_stats') {
        houseStats = { totalIn: 0, totalOut: 0, houseProfit: 0, prizePool: 0 };
        return res.json({ msg: "Caixa zerado!" });
    }
    
    // Aprovar Saque (Admin confirmou que pagou)
    if(action === 'approve_withdraw') {
        // Remove da fila
        withdrawalsQueue = withdrawalsQueue.filter(w => w.id !== id);
        // O dinheiro já saiu do saldo do usuário, então aqui só registramos a saída "real" se quiser
        // houseStats.totalOut += valor... (Opcional)
        return res.json({ msg: "Saque baixado com sucesso!" });
    }
});

// --- ROTA DO JOGO (Giro) ---
app.post('/api/spin', (req, res) => {
    const { bets, cpf } = req.body;
    const user = usersDB[cpf];
    
    if (!user) return res.status(401).json({ error: "Login necessário." });

    let totalBet = 0;
    let highestBetTeam = null;
    let highestBetValue = 0;

    // Calcula aposta total e identifica onde o usuário apostou mais
    for (const t in bets) {
        const val = parseFloat(bets[t]) || 0;
        if (val > 0) {
            totalBet += val;
            if(val > highestBetValue) {
                highestBetValue = val;
                highestBetTeam = t;
            }
        }
    }

    if (totalBet <= 0 || totalBet > user.balance) return res.status(400).json({ error: "Aposta inválida ou saldo insuficiente." });

    // 1. Processa a entrada de dinheiro
    user.balance -= totalBet;
    houseStats.totalIn += totalBet;
    houseStats.houseProfit += totalBet;
    
    // Separa 20% para o Pote
    const poolContribution = totalBet * POOL_PERCENT;
    houseStats.prizePool += poolContribution;

    // 2. Decide o Resultado
    let resultIndex;
    let resultSlot;
    let isForcedWin = false;

    // LÓGICA DO POTE OU COMANDO ADMIN
    if (nextSpinMustWin || houseStats.prizePool >= POOL_TARGET) {
        if (highestBetTeam) {
            // Tenta achar o time que o usuário apostou para ele ganhar
            const winningIndices = [];
            BOARD.forEach((slot, idx) => {
                if(slot.id === highestBetTeam) winningIndices.push(idx);
            });
            
            if(winningIndices.length > 0) {
                resultIndex = winningIndices[Math.floor(Math.random() * winningIndices.length)];
                resultSlot = BOARD[resultIndex];
                isForcedWin = true;
                
                // Reseta triggers
                nextSpinMustWin = false;
                if(houseStats.prizePool >= POOL_TARGET) {
                    houseStats.prizePool = 0; // Pote esvazia
                }
            }
        }
    }

    // Se não foi forçado, sorteio normal (RNG)
    if (!isForcedWin) {
        resultIndex = Math.floor(Math.random() * BOARD.length);
        resultSlot = BOARD[resultIndex];
    }

    // 3. Atualiza Histórico
    gameHistory.unshift(resultSlot.id);
    if (gameHistory.length > 15) gameHistory.pop();

    // 4. Calcula Prêmio
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
        history: gameHistory 
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Global Cup Ultimate rodando na porta ${PORT}`));
