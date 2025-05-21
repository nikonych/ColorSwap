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

// MongoDB соединение
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/colorsdb';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB подключена'))
  .catch(err => console.error('Ошибка подключения MongoDB:', err));

// Схема и модель для цветов и объектов
const colorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  color: { type: String, required: true },
  object: { type: String, required: true }
});

const Color = mongoose.model('Color', colorSchema);

// Схема и модель для последнего выбранного цвета
const selectionSchema = new mongoose.Schema({
  id: { type: String, default: 'lastSelection', required: true, unique: true },
  colorName: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Selection = mongoose.model('Selection', selectionSchema);

// Инициализация базы данных, если она пуста
async function initializeDatabase() {
  const count = await Color.countDocuments();

  if (count === 0) {
    const initialColors = [
      { name: 'Yellow', color: '#FFEB3B', object: 'бабочка' },
      { name: 'Orange', color: '#FF9800', object: 'звезда/палочка' },
      { name: 'Green', color: '#4CAF50', object: 'костюм' },
      { name: 'Red', color: '#F44336', object: 'шляпа' },
      { name: 'Blue', color: '#2196F3', object: 'плащ' }
    ];

    try {
      await Color.insertMany(initialColors);

      // Устанавливаем желтый как начальный выбранный цвет
      await Selection.findOneAndUpdate(
        { id: 'lastSelection' },
        { colorName: 'Yellow', timestamp: new Date() },
        { upsert: true, new: true }
      );

      console.log('База данных инициализирована с начальными данными');
    } catch (err) {
      console.error('Ошибка при инициализации данных:', err);
    }
  }
}

// Routes
app.get('/api/colors', async (req, res) => {
  try {
    const colors = await Color.find({}, 'name color object');
    res.json(colors);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
});

// Сохранить выбранный цвет
app.post('/api/select', async (req, res) => {
  try {
    const { colorName } = req.body;

    // Проверяем, существует ли такой цвет
    const color = await Color.findOne({ color: colorName });
    if (!color) {
      return res.status(404).json({ message: 'Цвет не найден' });
    }

    console.log(`Выбираем цвет: ${colorName}`);

    // Удаляем предыдущую запись перед созданием новой
    await Selection.deleteMany({ id: 'lastSelection' });

    // Создаем новую запись о выбранном цвете
    const newSelection = new Selection({
      id: 'lastSelection',
      colorName,
      timestamp: new Date()
    });

    await newSelection.save();

    console.log(`Сохранен цвет: ${colorName}, объект: ${color.object}`);

    res.json({ message: 'Цвет успешно выбран', object: color.object });
  } catch (err) {
    console.error('Ошибка при сохранении выбора:', err);
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
});

// Получить текущий выбранный цвет и объект
app.get('/api/current', async (req, res) => {
  try {
    const selection = await Selection.findOne({ id: 'lastSelection' });

    if (!selection) {
      return res.status(404).json({ message: 'Нет выбранного цвета' });
    }

    const color = await Color.findOne({ color: selection.colorName });

    if (!color) {
      return res.status(404).json({ message: 'Выбранный цвет не найден в базе данных' });
    }

    res.json({
      colorName: selection.colorName,
      object: color.object,
      timestamp: selection.timestamp
    });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
});

// Старый эндпоинт для совместимости
app.get('/api/colors/:name', async (req, res) => {
  try {
    const colorName = req.params.name;
    const color = await Color.findOne({ name: new RegExp(colorName, 'i') });

    if (!color) {
      return res.status(404).json({ message: 'Цвет не найден' });
    }

    res.json({ object: color.object });
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера', error: err.message });
  }
});

// Запуск сервера после подключения к БД
mongoose.connection.once('open', async () => {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });
});