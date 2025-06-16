const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const initialColors = [
    {name: 'Yellow', color: '#FFEB3B', object: 'fliege'},
    {name: 'Orange', color: '#FF9800', object: 'zauberstab'},
    {name: 'Green', color: '#4CAF50', object: 'zauberanzug'},
    {name: 'Red', color: '#F44336', object: 'zauberhut'},
    {name: 'Blue', color: '#2196F3', object: 'zauberumhang'}
];

// Текущий индекс и данные
let currentIndex = 0;
let currentData = {
    colorName: initialColors[currentIndex].color,
    object: initialColors[currentIndex].object
};

// Routen
app.get('/api/colors', (req, res) => {
    res.json(initialColors);
});

// Gewählte Farbe speichern
app.post('/api/select', (req, res) => {
    const { colorName } = req.body;

    // Найти объект по цвету
    const colorObj = initialColors.find(c => c.color === colorName);

    if (!colorObj) {
        return res.status(404).json({message: 'Farbe nicht gefunden'});
    }

    currentData = {
        colorName: colorName,
        object: colorObj.object
    };

    res.json({success: true, object: colorObj.object});
});

// Aktuell gewählte Farbe und Objekt abrufen
app.get('/api/current', (req, res) => {
    res.json(currentData);
});

// Alte Route für Kompatibilität
app.get('/api/colors/:name', (req, res) => {
    const colorName = req.params.name.toLowerCase();
    const color = initialColors.find(c => c.name.toLowerCase().includes(colorName));

    if (!color) {
        return res.status(404).json({message: 'Farbe nicht gefunden'});
    }

    res.json({object: color.object});
});
// Serverstart nach erfolgreicher DB-Verbindung
function startServer() {
    app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Server wird heruntergefahren...');
    process.exit(0);
});

startServer();