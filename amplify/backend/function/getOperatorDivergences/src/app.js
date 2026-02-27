const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { MongoClient } = require('mongodb');

const app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

// Configuração de CORS para o React conseguir acessar sem bloqueios
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

// Cache da conexão com o banco (Evita lentidão em múltiplas requisições)
let cachedClient = null;
async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  cachedClient = client;
  return client;
}

// Nossa rota principal do relatório
app.get('/divergence-report', async function(req, res) {
  try {
    const qs = req.query || {};
    
    // O React vai enviar o operatorId na requisição
    const operatorId = qs.operatorId;
    if (!operatorId) {
      return res.status(400).json({ error: 'O operatorId é obrigatório.' });
    }

    // Montando os Filtros Cumulativos
    const query = { operatorId: operatorId };

    if (qs.projectId) query.projectId = qs.projectId;
    if (qs.status) query.status = qs.status;
    if (qs.pendingPhase) query.taskPhaseTitle = qs.pendingPhase;
    if (qs.inProgressPhase) query.currentTaskPhase = qs.inProgressPhase;
    if (qs.lastDonePhase) query.lastTaskDonePhase = qs.lastDonePhase;

    if (qs.startDate || qs.endDate) {
      query.startDate = {};
      if (qs.startDate) query.startDate.$gte = qs.startDate;
      if (qs.endDate) query.startDate.$lte = qs.endDate;
    }

    // Configurando Ordenação
    const sortField = qs.sortField || 'startDate';
    const sortDir = qs.sortDirection === 'DESC' ? -1 : 1;
    const sortConfig = { [sortField]: sortDir };

    // Conectando e buscando na View
    const client = await connectToDatabase();
    const db = client.db(process.env.DB_NAME); // O nome do banco será passado via variável de ambiente
    
    // ATENÇÃO: Confirme se o nome da view no MongoDB é exatamente este
    const results = await db.collection('operator_divergences_view')
      .find(query)
      .sort(sortConfig)
      .toArray();

    res.json(results);
  } catch (error) {
    console.error("Erro na Lambda:", error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.listen(3000, function() {
    console.log("App started");
});

module.exports = app;