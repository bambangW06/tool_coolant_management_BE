module.exports = {
  apps: [
    {
      name: "tcm-backend",
      script: "bin/www",
      cwd: "./",
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
