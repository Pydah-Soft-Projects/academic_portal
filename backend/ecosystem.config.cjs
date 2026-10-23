module.exports = {
  apps: [
    {
      name: "acad-backend",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "src/index.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/backend-error.log",
      out_file: "logs/backend-out.log",
      time: true,
    },
  ],
};
