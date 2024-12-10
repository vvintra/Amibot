const mysql = require("mysql2/promise");
const {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
} = require("@bot-whatsapp/bot");
const QRPortalWeb = require("@bot-whatsapp/portal");
const BaileysProvider = require("@bot-whatsapp/provider/baileys");
const MySQLAdapter = require("@bot-whatsapp/database/mysql");

// Configuración de conexión a MySQL
const MYSQL_DB_HOST = "localhost";
const MYSQL_DB_USER = "root";
const MYSQL_DB_PASSWORD = "P4j4r170";
const MYSQL_DB_NAME = "amibot";
const MYSQL_DB_PORT = "3306";

// Configuración del adaptador de base de datos para @bot-whatsapp
const databaseAdapter = new MySQLAdapter({
  host: MYSQL_DB_HOST,
  user: MYSQL_DB_USER,
  password: MYSQL_DB_PASSWORD,
  database: MYSQL_DB_NAME,
  port: MYSQL_DB_PORT,
});

// Conexión a la base de datos con mysql2/promise
const mysqlDB = mysql.createPool({
  host: MYSQL_DB_HOST,
  user: MYSQL_DB_USER,
  password: MYSQL_DB_PASSWORD,
  database: MYSQL_DB_NAME,
  port: MYSQL_DB_PORT,
});

// Función para crear la tabla si no existe
const initializeDatabase = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS vendedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        empresa VARCHAR(255),
        nombre VARCHAR(255),
        cargo VARCHAR(255),
        direccion VARCHAR(255),
        email VARCHAR(255),
        provincia VARCHAR(255),
        marca VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;
    await mysqlDB.query(query);
    console.log("Tabla 'vendedores' creada/verificada con éxito.");
  } catch (error) {
    console.error("Error al crear la tabla 'vendedores':", error);
    process.exit(1); // Salir si no se puede crear la tabla
  }
};

initializeDatabase();

// Función para normalizar el texto del usuario
const normalizeInput = (input) => {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Función para validar si la entrada contiene números
const containsNumber = (input) => /\d/.test(input);

// Función para derivar contactos según selección
const derivarContactos = async (sessionId) => {
  try {
    const query = `SELECT provincia, marca FROM vendedores WHERE session_id = ?`;
    const [rows] = await mysqlDB.query(query, [sessionId]);

    if (!rows || rows.length === 0) {
      return `No se encontró información para esta sesión.`;
    }

    const { provincia, marca } = rows[0];

    const p = normalizeInput(provincia);
    const m = normalizeInput(marca);

    // Lógica de asignación de contactos
    // COTELLA
    if (m.includes("cotella")) {
      // Provincias: Salta, Jujuy, Interior de Tucumán, Santiago del Estero, Santa Fe, Córdoba
      if (
        p.includes("salta") ||
        p.includes("jujuy") ||
        p.includes("interior de tucuman") ||
        p.includes("santiago del estero") ||
        p.includes("santa fe") ||
        p.includes("córdoba") ||
        p.includes("cordoba")
      ) {
        return "Contacto: Daniel Montini";
      }
    }

    // RIVOLI
    if (
      m.includes("rivoli") ||
      m.includes("chicago") ||
      m.includes("ricatto")
    ) {
      // Catamarca, La Rioja, Santiago del Estero, Interior de Tucumán
      if (
        p.includes("catamarca") ||
        p.includes("la rioja") ||
        p.includes("santiago del estero") ||
        p.includes("interior de tucuman")
      ) {
        return "Contacto: Jorge Quiroga";
      }

      // Salta, Jujuy
      if (p.includes("salta") || p.includes("jujuy")) {
        return "Contacto: Ricardo Correa";
      }

      // San Miguel de Tucumán
      if (p.includes("san miguel de tucuman")) {
        return "Contacto: Raul Posse";
      }

      // Chaco, Formosa, Corrientes, Misiones
      if (
        p.includes("chaco") ||
        p.includes("formosa") ||
        p.includes("corrientes") ||
        p.includes("misiones")
      ) {
        return "Contacto: Sergio Tonetti";
      }
    }

    return `No se encontró un contacto asignado para esta combinación de marca y provincia.`;
  } catch (error) {
    console.error("Error en la consulta SQL:", error);
    return `Error al consultar la base de datos.`;
  }
};

// Flujos
const flowRRHH = addKeyword([
  "busco trabajo",
  "curriculum",
  "quiero trabajar",
]).addAnswer(
  `「💼」¡Nos alegra que quieras formar parte del Equipo Rivoli! 
Envía tu Currículum Vitae al siguiente Email: seleccionrrhh@fideosrivoli.com o ingresa a nuestra página web en https://fideosrivoli.com/ en la pestaña "contacto". 
El sector de Recursos Humanos evaluará tu perfil y se pondrá en contacto en caso de una vacante. 
¡Saludos! 🙌`
);

const flowProveedores = addKeyword([
  "compras",
  "proveedor",
  "ofrecer servicio",
  "provedor",
]).addAnswer(
  `「📦」Para tu propuesta, nuestro sector de compras está dividido en los siguientes rubros:
- Compras de packaging: 
   - Mail: mpinsumos@fideosrivoli.com
- Compras generales:
   - Mail: comprasjcuenca@fideosrivoli.com, compras@fideosrivoli.com
✆ Teléfono: 4260701`
);

const flowVendedores = addKeyword([
  "quiero vender sus productos",
  "quiero saber precios",
  "información sobre venta mayorista",
  "soy vendedor",
]).addAnswer(
  `「🛒」Buen día estimad@. ¡Muchas gracias por elegir nuestra marca!
Por favor, indique en qué provincia reside:
- Catamarca
- La Rioja
- Santiago del Estero
- Tucumán (interior)
- Salta
- Santa Fe
- Córdoba
- Jujuy
- San Miguel de Tucumán
- Chaco
- Formosa
- Corrientes
- Misiones`,
  { capture: true },
  async (ctx, { flowDynamic }) => {
    const provincia = normalizeInput(ctx.body);

    if (containsNumber(provincia)) {
      await flowDynamic(`Por favor, no ingrese números. Intente nuevamente.`);
      return;
    }

    const sessionId = ctx.from;

    try {
      const query = `INSERT INTO vendedores (session_id, provincia) VALUES (?, ?) ON DUPLICATE KEY UPDATE provincia = ?`;
      await mysqlDB.query(query, [sessionId, provincia, provincia]);

      await flowDynamic(`Ahora por favor seleccione en qué producto está interesado:
- *Rivoli, Chicago, Ricatto*
- *Cotella*`);
    } catch (error) {
      console.error("q:", error);
      await flowDynamic(
        `Ocurrió un error al procesar su solicitud. Intente nuevamente más tarde.`
      );
    }
  }
);

const flowProductos = addKeyword([
  "rivoli",
  "cotella",
  "chicago",
  "ricatto",
]).addAnswer(
  `¡Marca seleccionada con éxito! Por favor espere...`,
  { capture: true },
  async (ctx, { flowDynamic }) => {
    const marca = normalizeInput(ctx.body);

    if (containsNumber(marca)) {
      await flowDynamic(`Por favor, no ingrese números. Intente nuevamente.`);
      return;
    }

    const sessionId = ctx.from;
    const updateQuery = `UPDATE vendedores SET marca = ? WHERE session_id = ?`;
    await mysqlDB.query(updateQuery, [marca, sessionId]);

    const contacto = await derivarContactos(sessionId);
    await flowDynamic(contacto);
  }
);

const flowPrincipal = addKeyword(["hola", "inicio", "ayuda"])
  .addAnswer(
    "「👋」¡Hola! Soy Amibot, tu asistente virtual. ¿En qué puedo ayudarte?"
  )
  .addAnswer(
    `Por favor, escribe una opción:
- *Busco trabajo*
- *Soy proveedor*
- *Soy vendedor*`,
    { capture: true },
    async (ctx, { flowDynamic }) => {
      const userInput = normalizeInput(ctx.body);

      if (containsNumber(userInput)) {
        await flowDynamic(`Por favor, no ingrese números. Intente nuevamente.`);
        return;
      }

      if (userInput.includes("busco trabajo")) {
        await flowDynamic(flowRRHH);
      } else if (userInput.includes("proveedor")) {
        await flowDynamic(flowProveedores);
      } else if (userInput.includes("vendedor")) {
        await flowDynamic(flowVendedores);
      } else {
        await flowDynamic(
          `Lo siento, no entendí tu respuesta. Por favor, intente nuevamente.`
        );
      }
    }
  );

// Inicialización del bot
const main = async () => {
  const adapterFlow = createFlow([
    flowRRHH,
    flowProveedores,
    flowVendedores,
    flowProductos,
    flowPrincipal,
  ]);
  const adapterProvider = createProvider(BaileysProvider);

  createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: databaseAdapter,
  });

  QRPortalWeb();
};

main();
