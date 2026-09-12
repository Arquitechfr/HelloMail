// pm2 — Configuration des deux process Mailora.
//
// pm2 est installé globalement sur le serveur de prod.
// Usage : pm2 start ecosystem.config.cjs
//
// .cjs obligatoire car package.json a "type": "module".
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'mailora-api',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    },
    {
      name: 'mailora-worker',
      script: 'dist/worker.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    },
  ],
};
