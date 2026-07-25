import 'dotenv/config';
import app from './app.js';
import { startListener } from './config/listener.js';

const PORT = process.env.PORT || 3000;

startListener();

app.listen(3000, () => {
  console.log(`[server] listening on http://localhost:3000`);
});
