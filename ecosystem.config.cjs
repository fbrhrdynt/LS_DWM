module.exports = {
  apps: [
    {
      name: 'dwm',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
