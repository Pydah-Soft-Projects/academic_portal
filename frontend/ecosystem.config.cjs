module.exports = {
  apps: [
    {
      name: "acad-frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/frontend-error.log",
      out_file: "logs/frontend-out.log",
      time: true,
    },
  ],
};
