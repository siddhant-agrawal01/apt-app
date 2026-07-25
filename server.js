import 'dotenv/config';
import app from './app.js';
import { startListener } from './src/config/listener.js';

const PORT = process.env.PORT || 4000;

startListener();

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
