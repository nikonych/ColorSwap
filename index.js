const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB-Verbindung
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/colorsdb';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB verbunden'))
    .catch(err => console.error('Fehler beim Verbinden mit MongoDB:', err));

// Schema und Modell für Farben und Objekte
const colorSchema = new mongoose.Schema({
    name: {type: String, required: true, unique: true},
    color: {type: String, required: true},
    object: {type: String, required: true}
});

const Color = mongoose.model('Color', colorSchema);

// Schema und Modell für die zuletzt gewählte Farbe
const selectionSchema = new mongoose.Schema({
    id: {type: String, default: 'lastSelection', required: true, unique: true},
    colorName: {type: String, required: true},
    timestamp: {type: Date, default: Date.now}
});

const Selection = mongoose.model('Selection', selectionSchema);

// Initialisierung der Datenbank, falls leer
async function initializeDatabase() {
    const count = await Color.countDocuments();

    if (count === 0) {
        const initialColors = [
            {name: 'Yellow', color: '#FFEB3B', object: 'Fliege'}, // Именно "Fliege"
            {name: 'Orange', color: '#FF9800', object: 'Zauberstab'}, // Именно "Zauberstab"
            {name: 'Green', color: '#4CAF50', object: 'Zauberanzug'}, // Именно "Zauberanzug"
            {name: 'Red', color: '#F44336', object: 'Zauberhut'},    // Именно "Zauberhut"
            {name: 'Blue', color: '#2196F3', object: 'Zauberumhang'} // Именно "Zauberumhang"
        ];

        try {
            await Color.insertMany(initialColors);

            // Setzt Gelb als standardmäßig gewählte Farbe
            await Selection.findOneAndUpdate(
                {id: 'lastSelection'},
                {colorName: 'Yellow', timestamp: new Date()},
                {upsert: true, new: true}
            );

            console.log('Datenbank mit Anfangsdaten initialisiert');
        } catch (err) {
            console.error('Fehler bei der Initialisierung der Daten:', err);
        }
    }
}

// Routen
app.get('/api/colors', async (req, res) => {
    try {
        const colors = await Color.find({}, 'name color object');
        res.json(colors);
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    }
});

// Gewählte Farbe speichern
app.post('/api/select', async (req, res) => {
    try {
        const {colorName} = req.body;

        // Prüfen, ob diese Farbe existiert
        const color = await Color.findOne({color: colorName});
        if (!color) {
            return res.status(404).json({message: 'Farbe nicht gefunden'});
        }

        console.log(`Farbe wird gewählt: ${colorName}`);

        // Alte Auswahl entfernen
        await Selection.deleteMany({id: 'lastSelection'});

        // Neue Auswahl speichern
        const newSelection = new Selection({
            id: 'lastSelection',
            colorName,
            timestamp: new Date()
        });

        await newSelection.save();

        console.log(`Farbe gespeichert: ${colorName}, Objekt: ${color.object}`);

        res.json({message: 'Farbe erfolgreich gewählt', object: color.object});
    } catch (err) {
        console.error('Fehler beim Speichern der Auswahl:', err);
        res.status(500).json({message: 'Serverfehler', error: err.message});
    }
});

// Aktuell gewählte Farbe und Objekt abrufen
app.get('/api/current', async (req, res) => {
    try {
        const selection = await Selection.findOne({id: 'lastSelection'});

        if (!selection) {
            return res.status(404).json({message: 'Keine Farbe gewählt'});
        }

        const color = await Color.findOne({color: selection.colorName});

        if (!color) {
            return res.status(404).json({message: 'Gewählte Farbe nicht in der Datenbank gefunden'});
        }

        res.json({
            colorName: selection.colorName,
            object: color.object,
            timestamp: selection.timestamp
        });
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    }
});

// Alte Route für Kompatibilität
app.get('/api/colors/:name', async (req, res) => {
    try {
        const colorName = req.params.name;
        const color = await Color.findOne({name: new RegExp(colorName, 'i')});

        if (!color) {
            return res.status(404).json({message: 'Farbe nicht gefunden'});
        }

        res.json({object: color.object});
    } catch (err) {
        res.status(500).json({message: 'Serverfehler', error: err.message});
    }
});

// Serverstart nach erfolgreicher DB-Verbindung
mongoose.connection.once('open', async () => {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
});
