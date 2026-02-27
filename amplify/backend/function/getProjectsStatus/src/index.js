const { MongoClient } = require('mongodb');

// Recomendo deixar a URI do Mongo configurada nas variáveis de ambiente da sua Lambda
const MONGODB_URI = process.env.MONGODB_URI; 
const dbName = 'martins'; // Nome do seu banco de dados 

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

exports.handler = async (event) => {
  try {
    const client = await connectToDatabase();
    const db = client.db(dbName);

    // A mágica do MongoDB: Consultamos a view e já fazemos o Join (lookup) com as justificativas
    const pipeline = [
      {
        $lookup: {
          from: "statusProjects",       // A nova collection de justificativas
          localField: "projectId",      // ID do projeto na sua view
          foreignField: "projectId",    // ID do projeto salvo na justificativa
          as: "justifications"          // O nome do array que vai ser devolvido pro Frontend
        }
      },
      // Opcional: ordenar para mostrar os projetos mais recentes ou atrasados primeiro
      {
        $sort: { "daysInProject": -1 } 
      }
    ];

    // Executamos a consulta direto na View
    const projectsData = await db.collection('view_project_status').aggregate(pipeline).toArray();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Evita erros de CORS no Next.js
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify(projectsData),
    };

  } catch (error) {
    console.error("Erro ao buscar relatório de projetos:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ error: "Erro interno ao consultar o banco de dados." }),
    };
  }
};