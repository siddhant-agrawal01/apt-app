import 'dotenv/config';
import app from './app.js';



app.listen(3000, () => {
  console.log(`[server] listening on http://localhost:3000`);
});
