const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const dbName = 'martins';

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

    const method = event.httpMethod;

    // ================================
    // GET - LISTAR PROJETOS
    // ================================
    if (method === "GET") {

      const pipeline = [
        {
          $lookup: {
            from: "statusProjects",
            localField: "projectId",
            foreignField: "projectId",
            as: "justifications"
          }
        },
        { $sort: { daysInProject: -1 } }
      ];

      const projectsData = await db
        .collection('view_project_status')
        .aggregate(pipeline)
        .toArray();

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(projectsData),
      };
    }

    // ================================
    // POST - SALVAR JUSTIFICATIVA
    // ================================
    if (method === "POST") {

      const body = JSON.parse(event.body || "{}");
      const { projectId, reason } = body;

      if (!projectId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "projectId é obrigatório." })
        };
      }

      await db.collection("statusProjects").updateOne(
        { projectId: projectId },
        {
          $set: {
            projectId,
            reason: reason || "",
            updatedAt: new Date()
          }
        },
        { upsert: true } // cria se não existir
      );

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };

  } catch (error) {
    console.error("Erro na API:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({ error: "Erro interno no servidor." }),
    };
  }
};