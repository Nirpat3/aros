/**
 * PM2 Ecosystem Config — AROS Platform
 * https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name: 'aros-platform',
      script: 'src/server.ts',
      interpreter: 'node_modules/.bin/tsx',
      cwd: '/opt/aros-platform',
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      error_file: '/var/log/aros/error.log',
      out_file: '/var/log/aros/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env: {
        NODE_ENV: 'development',
        PORT: 5457,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5457,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5457,
      },
    },
  ],
};
