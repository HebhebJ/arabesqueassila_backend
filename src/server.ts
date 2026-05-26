import app from './app';
import { env } from './config/env';

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Arabesque API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${env.NODE_ENV}`);
});
