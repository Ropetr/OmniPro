const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.WIDGET_PORT || 3002;

app.use(express.static(path.join(__dirname, 'public')));

// Serve widget loader script
app.get('/loader.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'public', 'loader.js'));
});

// Serve widget iframe
app.get('/widget', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

app.listen(PORT, () => {
  console.log(`OmniPro Widget server running on port ${PORT}`);
});
