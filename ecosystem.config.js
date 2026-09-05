// PM2 konfiguráció az éles (DigitalOcean) szerverre.
// A másik oldal (weblap) a 3000-es porton fut, ezért ez a 3001-esen.
module.exports = {
  apps: [
    {
      name: 'termektesztek',
      cwd: '/var/www/termektesztek',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      autorestart: true,
      error_file: '/var/www/termektesztek/pm2-error.log',
      out_file: '/var/www/termektesztek/pm2-out.log',
      time: true,
    },
  ],
};
