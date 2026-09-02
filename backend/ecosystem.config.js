module.exports = {
  apps: [{
    name: "instrument-backend",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 3002
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    merge_logs: true
  }]
};
