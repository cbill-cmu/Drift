/**
 * PM2 ecosystem stub — run from repo root on the VPS after backend is ready.
 * Usage: pm2 start shared/deployment/pm2-config.js
 */
export default {
  apps: [
    {
      name: "drift-api",
      cwd: "./backend",
      script: "src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
