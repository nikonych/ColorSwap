const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL-Verbindung
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: process.env.POSTGRES_DB || 'colorsdb',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: process.env.POSTGRES_PORT || 5432,
});

// Tabellen erstellen
async function createTables() {
    const client = await pool.connect();
    try {
        // Tabelle für Farben und Objekte
        await client.query(`
            CREATE TABLE IF NOT EXISTS colors (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                color VARCHAR(7) NOT NULL,
                object VARCHAR(255) NOT NULL
            )
        `);

        // Tabelle für die zuletzt gewählte Farbe
        await client.query(`
            CREATE TABLE IF NOT EXISTS selections (
                id VARCHAR(255) PRIMARY KEY DEFAULT 'lastSelection',
                color_name VARCHAR(7) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Tabellen erfolgreich erstellt');
    } catch (err) {
        console.error('Fehler beim Erstellen der Tabellen:', err);
    } finally {
        client.release();
    }
}

// Initialisierung der Datenbank, falls leer
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT COUNT(*) FROM colors');
        const count = parseInt(result.rows[0].count);

        if (count === 0) {
            const initialColors = [
                {name: 'Yellow', color: '#FFEB3B', object: 'fliege'},
                {name: 'Orange', color: '#FF9800', object: 'zauberstab'},
                {name: 'Green', color: '#4CAF50', object: 'zauberanzug'},
                {name: 'Red', color: '#F44336', object: 'zauberhut'},
                {name: 'Blue', color: '#2196F3', object: 'zauberumhang'}
            ];

            // Farben einfügen
            for (const colorData of initialColors) {
                await client.query(
                    'INSERT INTO colors (name, color, object) VALUES ($1, $2, $3)',
                    [colorData.name, colorData.color, colorData.object]
                );
            }

            // Gelb als standardmäßig gewählte Farbe setzen
            await client.query(`
                INSERT INTO selections (id, color_name, timestamp) 
                VALUES ('lastSelection', '#FFEB3B', CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET 
                color_name = EXCLUDED.color_name, 
                timestamp = EXCLUDED.timestamp
            `);

            console.log('Datenbank mit Anfangsdaten initialisiert');
        }
    } catch (err) {
        console.error('Fehler bei der Initialisierung der Daten:', err);
    } finally {
        client.release();
    }
}

// Routen
app.get('/api/colors', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT name, color, object FROM colors');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    } finally {
        client.release();
    }
});

// Gewählte Farbe speichern
app.post('/api/select', async (req, res) => {
    const client = await pool.connect();
    try {
        const {colorName} = req.body;

        // Prüfen, ob diese Farbe existiert
        const colorResult = await client.query('SELECT * FROM colors WHERE color = $1', [colorName]);
        if (colorResult.rows.length === 0) {
            return res.status(404).json({message: 'Farbe nicht gefunden'});
        }

        const color = colorResult.rows[0];
        console.log(`Farbe wird gewählt: ${colorName}`);

        // Neue Auswahl speichern (upsert)
        await client.query(`
            INSERT INTO selections (id, color_name, timestamp) 
            VALUES ('lastSelection', $1, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET 
            color_name = EXCLUDED.color_name, 
            timestamp = EXCLUDED.timestamp
        `, [colorName]);

        console.log(`Farbe gespeichert: ${colorName}, Objekt: ${color.object}`);

        res.json({message: 'Farbe erfolgreich gewählt', object: color.object});
    } catch (err) {
        console.error('Fehler beim Speichern der Auswahl:', err);
        res.status(500).json({message: 'Serverfehler', error: err.message});
    } finally {
        client.release();
    }
});

// Aktuell gewählte Farbe und Objekt abrufen
app.get('/api/current', async (req, res) => {
    const client = await pool.connect();
    try {
        const selectionResult = await client.query('SELECT * FROM selections WHERE id = $1', ['lastSelection']);

        if (selectionResult.rows.length === 0) {
            return res.status(404).json({message: 'Keine Farbe gewählt'});
        }

        const selection = selectionResult.rows[0];
        const colorResult = await client.query('SELECT * FROM colors WHERE color = $1', [selection.color_name]);

        if (colorResult.rows.length === 0) {
            return res.status(404).json({message: 'Gewählte Farbe nicht in der Datenbank gefunden'});
        }

        const color = colorResult.rows[0];

        res.json({
            colorName: selection.color_name,
            object: color.object,
            timestamp: selection.timestamp
        });
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    } finally {
        client.release();
    }
});

// Alte Route für Kompatibilität
app.get('/api/colors/:name', async (req, res) => {
    const client = await pool.connect();
    try {
        const colorName = req.params.name;
        const result = await client.query('SELECT * FROM colors WHERE name ILIKE $1', [`%${colorName}%`]);

        if (result.rows.length === 0) {
            return res.status(404).json({message: 'Farbe nicht gefunden'});
        }

        res.json({object: result.rows[0].object});
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    } finally {
        client.release();
    }
});

// Serverstart nach erfolgreicher DB-Verbindung
async function startServer() {
    try {
        await createTables();
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`Server läuft auf Port ${PORT}`);
        });
    } catch (err) {
        console.error('Fehler beim Starten des Servers:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Server wird heruntergefahren...');
    await pool.end();
    process.exit(0);
});

startServer();