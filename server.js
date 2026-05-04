const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variável para guardar a conexão com o nosso banco de dados
let db;

// Função que cria o arquivo do banco de dados na sua pasta
async function iniciarBanco() {
    db = await open({
        filename: 'banco.sqlite',
        driver: sqlite3.Database
    });

    // Cria a "tabela" (como se fosse uma planilha do Excel) para guardar os dados
    await db.exec(`
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            servico TEXT,
            data TEXT,
            hora TEXT
        )
    `);
}
iniciarBanco(); // Chama a função para ligar o banco logo que o servidor iniciar

app.post('/api/agendar', async (req, res) => {
    const { nome, servico, data, hora } = req.body;

    // --- LÓGICA DE ESPAÇAMENTO DE 1 HORA ---
    const [hNovo, mNovo] = hora.split(':').map(Number);
    const minutosNovo = (hNovo * 60) + mNovo;

    // Vai no Banco de Dados e pega TODOS os agendamentos marcados para esse mesmo DIA
    const agendamentosDoDia = await db.all('SELECT * FROM agendamentos WHERE data = ?', [data]);

    let chocou = false;
    let clienteConflito = '';
    let horaConflito = '';

    // Verifica um por um se algum está a menos de 1 hora de diferença
    for (let agendamento of agendamentosDoDia) {
        const [hExistente, mExistente] = agendamento.hora.split(':').map(Number);
        const minutosExistente = (hExistente * 60) + mExistente;
        const diferenca = Math.abs(minutosNovo - minutosExistente);

        if (diferenca < 60) {
            chocou = true;
            clienteConflito = agendamento.nome;
            horaConflito = agendamento.hora;
            break; // Já achou problema, para de procurar
        }
    }

    // SE BATER COM O INTERVALO: Bloqueia!
    if (chocou) {
        console.log(`\n⚠️ BLOQUEADO: ${nome} tentou às ${hora}, mas choca com ${clienteConflito} (${horaConflito}).`);
        return res.status(400).json({ 
            mensagem: `Poxa, ${nome}. O horário das ${hora} está muito perto do agendamento das ${horaConflito}. Precisamos de pelo menos 1 hora de intervalo. Escolha outro horário!` 
        });
    }

    // SE ESTÁ LIVRE: Salva no Banco de Dados DEFINITIVAMENTE!
    await db.run('INSERT INTO agendamentos (nome, servico, data, hora) VALUES (?, ?, ?, ?)', [nome, servico, data, hora]);

    console.log('\n==================================');
    console.log('💾 NOVO HORÁRIO SALVO NO BANCO DE DADOS!');
    console.log(`Cliente: ${nome}`);
    console.log(`Data e Hora: ${data.split('-').reverse().join('/')} às ${hora}`);
    console.log('==================================\n');

    res.status(201).json({ 
        mensagem: `Tudo certo, ${nome}! Seu horário na Hexe Barbearia foi confirmado para às ${hora}.` 
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor ONLINE com Banco de Dados SQLite ativado!`);
    console.log(`👉 Acesse o site: http://localhost:${PORT}`);
});